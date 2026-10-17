// Pure sync-decision logic: no I/O, no secrets. The Edge Function calls these, then applies the plan in one DB transaction.
export type ErrorCode = 'MISSING_TEAM_CODE' | 'UNKNOWN_TEAM_CODE' | 'INVALID_EMAIL' | 'INVALID_URL' | 'MISSING_REQUIRED' | 'MISSING_RESPONSE_KEY' | 'DUPLICATE_RESPONSE';
export interface SourceRow { responseKey?: string; submittedAt?: string; rowReference?: string; values: Record<string, string | undefined> }
export interface RowError { code: ErrorCode; message: string; responseKey?: string; rowReference?: string }

export const normalizeEmail = (s?: string) => (s ?? '').trim().toLowerCase();
export const normalizeTeamCode = (s?: string) => (s ?? '').trim().toUpperCase().replace(/\s+/g, '');
export const normalizeName = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (s: string) => EMAIL.test(s);
export function normalizeUrl(s?: string): string | null {
  const v = (s ?? '').trim(); if (!v) return null;
  try { const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString() : null; } catch { return null; }
}

/** Stable FNV-1a hash over key-sorted values; used to detect edited responses (never as identity). */
export function fingerprint(values: Record<string, string | undefined>): string {
  const canon = Object.keys(values).sort().map((k) => `${k}=${(values[k] ?? '').trim()}`).join('\u241f');
  let h = 0x811c9dc5; for (let i = 0; i < canon.length; i++) { h ^= canon.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export type MilestonePlan =
  | { action: 'create'; teamCode: string; fingerprint: string }
  | { action: 'update'; teamCode: string; fingerprint: string }
  | { action: 'reactivate'; teamCode: string; fingerprint: string }
  | { action: 'unchanged' }
  | { action: 'error'; error: RowError };
export interface ExistingSubmission { fingerprint: string; sourceDeleted: boolean }

/** Milestone rows attach to an EXISTING team by team code. They never create or modify a team. */
export function planMilestoneRow(row: SourceRow, teamCodes: ReadonlySet<string>, existing: ReadonlyMap<string, ExistingSubmission>): MilestonePlan {
  const base = { responseKey: row.responseKey, rowReference: row.rowReference };
  if (!row.responseKey) return { action: 'error', error: { ...base, code: 'MISSING_RESPONSE_KEY', message: 'This response has no stable response ID, so it cannot be imported safely. Re-run the Apps Script connector.' } };
  const code = normalizeTeamCode(row.values.team_code);
  if (!code) return { action: 'error', error: { ...base, code: 'MISSING_TEAM_CODE', message: 'This milestone response cannot be matched to a team.' } };
  if (!teamCodes.has(code)) return { action: 'error', error: { ...base, code: 'UNKNOWN_TEAM_CODE', message: `No team with code ${code} exists in this context.` } };
  const url = row.values.submission_url; if (url?.trim() && !normalizeUrl(url)) return { action: 'error', error: { ...base, code: 'INVALID_URL', message: 'Check the submission link.' } };
  const fp = fingerprint(row.values); const prev = existing.get(row.responseKey);
  if (!prev) return { action: 'create', teamCode: code, fingerprint: fp };
  if (prev.sourceDeleted) return { action: 'reactivate', teamCode: code, fingerprint: fp };
  return prev.fingerprint === fp ? { action: 'unchanged' } : { action: 'update', teamCode: code, fingerprint: fp };
}

export interface ExistingTeam { teamCode: string; name: string; leaderEmail?: string; overrides: ReadonlySet<string> }
export type RegistrationPlan =
  | { action: 'create'; fields: Record<string, string | null> }
  | { action: 'update'; teamCode: string; fields: Record<string, string | null>; conflicts: string[] }
  | { action: 'review_duplicate'; candidates: string[]; reason: string }
  | { action: 'error'; error: RowError };
const IMPORTABLE = ['name', 'leader_name', 'problem_statement', 'description', 'repository_url', 'demo_url'] as const;

/** Registration rows may create teams, but only after validation; name-only matches go to review, never auto-merge. */
export function planRegistrationRow(row: SourceRow, teams: readonly ExistingTeam[]): RegistrationPlan {
  const base = { responseKey: row.responseKey, rowReference: row.rowReference };
  const v = row.values; const name = (v.name ?? '').trim();
  if (!name) return { action: 'error', error: { ...base, code: 'MISSING_REQUIRED', message: 'Team name is required.' } };
  const email = normalizeEmail(v.leader_email);
  if (email && !isValidEmail(email)) return { action: 'error', error: { ...base, code: 'INVALID_EMAIL', message: 'Check the leader email address.' } };
  const fields: Record<string, string | null> = {};
  for (const k of IMPORTABLE) {
    const raw = (v[k] ?? '').trim(); if (!raw) continue;
    if (k.endsWith('_url')) { const u = normalizeUrl(raw); if (!u) return { action: 'error', error: { ...base, code: 'INVALID_URL', message: `Check the ${k.replace('_', ' ')}.` } }; fields[k] = u; } else fields[k] = raw;
  }
  const code = normalizeTeamCode(v.team_code);
  if (code) {
    const t = teams.find((x) => x.teamCode === code);
    if (!t) return { action: 'error', error: { ...base, code: 'UNKNOWN_TEAM_CODE', message: `No team with code ${code} exists.` } };
    const conflicts = Object.keys(fields).filter((k) => t.overrides.has(k)); for (const k of conflicts) delete fields[k];
    return { action: 'update', teamCode: code, fields, conflicts };
  }
  const dupes = teams.filter((t) => normalizeName(t.name) === normalizeName(name) || (email && t.leaderEmail && normalizeEmail(t.leaderEmail) === email)).map((t) => t.teamCode);
  if (dupes.length) return { action: 'review_duplicate', candidates: dupes, reason: 'Same team name or leader email as an existing team. Confirm before merging or creating.' };
  return { action: 'create', fields };
}

/** Source rows that vanished are marked source-deleted; teams are never touched. An empty read with existing data is treated as an access failure, not mass deletion. */
export function planSourceDeletions(existingKeys: readonly string[], seenKeys: ReadonlySet<string>): { markDeleted: string[]; abort?: string } {
  if (existingKeys.length > 0 && seenKeys.size === 0) return { markDeleted: [], abort: 'SOURCE_ACCESS_DENIED: the sheet returned no rows; skipping deletion handling.' };
  return { markDeleted: existingKeys.filter((k) => !seenKeys.has(k)) };
}

/** Flags response keys that appear twice in one read (e.g. a repeated submission). */
export function findRepeatedKeys(rows: readonly SourceRow[]): RowError[] {
  const seen = new Set<string>(); const out: RowError[] = [];
  for (const r of rows) { if (!r.responseKey) continue; if (seen.has(r.responseKey)) out.push({ code: 'DUPLICATE_RESPONSE', message: 'A similar response has already been imported.', responseKey: r.responseKey, rowReference: r.rowReference }); seen.add(r.responseKey); }
  return out;
}

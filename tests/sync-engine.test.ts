import test from 'node:test'; import assert from 'node:assert/strict';
import { fingerprint, normalizeUrl, planMilestoneRow, planRegistrationRow, planSourceDeletions, findRepeatedKeys, type ExistingSubmission } from '../src/features/sync/engine.ts';
const codes = new Set(['PT-000001']); const none = new Map<string, ExistingSubmission>();
const row = (o: object = {}) => ({ responseKey: 'r1', rowReference: 'row 2', values: { team_code: 'pt-000001', submission_url: 'github.com/x/y', note: 'v1' }, ...o });

test('milestone: new response creates a submission for the existing team', () => assert.equal(planMilestoneRow(row(), codes, none).action, 'create'));
test('milestone: re-running the same sync is idempotent', () => {
  const p = planMilestoneRow(row(), codes, none); assert.equal(p.action, 'create');
  const fp = p.action === 'create' ? p.fingerprint : '';
  assert.equal(planMilestoneRow(row(), codes, new Map([['r1', { fingerprint: fp, sourceDeleted: false }]])).action, 'unchanged');
});
test('milestone: edited response updates, not duplicates', () => {
  const old = fingerprint(row().values);
  const p = planMilestoneRow(row({ values: { ...row().values, note: 'v2' } }), codes, new Map([['r1', { fingerprint: old, sourceDeleted: false }]]));
  assert.equal(p.action, 'update');
});
test('milestone: row position change does not change identity', () => assert.equal(planMilestoneRow(row({ rowReference: 'row 99' }), codes, new Map([['r1', { fingerprint: fingerprint(row().values), sourceDeleted: false }]])).action, 'unchanged'));
test('milestone: missing/unknown team code and bad URL are reviewable errors', () => {
  const e = (v: object) => { const p = planMilestoneRow(row({ values: v }), codes, none); return p.action === 'error' ? p.error.code : p.action; };
  assert.equal(e({ note: 'x' }), 'MISSING_TEAM_CODE'); assert.equal(e({ team_code: 'PT-999999' }), 'UNKNOWN_TEAM_CODE'); assert.equal(e({ team_code: 'PT-000001', submission_url: 'not a url' }), 'INVALID_URL');
});
test('milestone: no stable response key is refused rather than guessed', () => { const p = planMilestoneRow(row({ responseKey: undefined }), codes, none); assert.ok(p.action === 'error' && p.error.code === 'MISSING_RESPONSE_KEY'); });
test('milestone: a previously source-deleted response that reappears is reactivated', () => assert.equal(planMilestoneRow(row(), codes, new Map([['r1', { fingerprint: 'x', sourceDeleted: true }]])).action, 'reactivate'));

const teams = [{ teamCode: 'PT-000001', name: 'Innovators', leaderEmail: 'a@x.edu', overrides: new Set(['repository_url']) }];
test('registration: new valid team is created', () => assert.equal(planRegistrationRow({ values: { name: 'Brand New', leader_email: 'n@x.edu' } }, teams).action, 'create'));
test('registration: same name goes to duplicate review, never silently merged', () => {
  const p = planRegistrationRow({ values: { name: '  innovators ' } }, teams); assert.ok(p.action === 'review_duplicate' && p.candidates[0] === 'PT-000001');
});
test('registration: invalid email does not produce a create or update', () => { const p = planRegistrationRow({ values: { name: 'T', leader_email: 'nope' } }, teams); assert.ok(p.action === 'error' && p.error.code === 'INVALID_EMAIL'); });
test('registration: professor override is kept and reported as a conflict', () => {
  const p = planRegistrationRow({ values: { team_code: 'PT-000001', name: 'Innovators', repository_url: 'https://github.com/new/repo' } }, teams);
  assert.ok(p.action === 'update'); assert.deepEqual(p.conflicts, ['repository_url']); assert.ok(!('repository_url' in p.fields));
});
test('deletions: vanished rows are marked, empty read aborts instead of mass-deleting', () => {
  assert.deepEqual(planSourceDeletions(['a', 'b'], new Set(['a'])).markDeleted, ['b']);
  const r = planSourceDeletions(['a', 'b'], new Set()); assert.deepEqual(r.markDeleted, []); assert.ok(r.abort);
});
test('repeated keys and url normalisation', () => {
  assert.equal(findRepeatedKeys([row(), row()]).length, 1);
  assert.equal(normalizeUrl('github.com/a/b'), 'https://github.com/a/b'); assert.equal(normalizeUrl('javascript:alert(1)'), null);
});

import { Router, type Response } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { withUser } from '../db.ts';

export const dataRouter = Router();
type Db = pg.PoolClient;
const run = <T>(res: Response, fn: (db: Db, uid: string) => Promise<T>) => withUser(res.locals.userId, (db) => fn(db, res.locals.userId));
const wrap = (fn: (req: any, res: Response) => Promise<unknown>) => (req: any, res: Response, next: any) => fn(req, res).catch(next);
const id = z.string().uuid();
const opt = (n: number) => z.string().trim().max(n).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable().optional().or(z.literal('').transform(() => null));

async function audit(db: Db, uid: string, type: string, entity: string | null, action: string, after?: unknown) {
  await db.query('insert into audit_events(owner_id,actor_id,entity_type,entity_id,action,after_data) values ($1,$1,$2,$3,$4,$5)', [uid, type, entity, action, after ? JSON.stringify(after) : null]);
}
/** Builds "set a=$2,b=$3" from only the keys the client sent. Column names come from a fixed allow-list, values are parameterised. */
function patchSql(table: string, allowed: string[], body: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const data = { ...body, ...extra }; const cols = Object.keys(data).filter((k) => allowed.includes(k) || k in extra);
  if (!cols.length) return null;
  return { sql: `update ${table} set ${cols.map((c, i) => `${c}=$${i + 2}`).join(',')} where id=$1 returning *`, vals: cols.map((c) => data[c]) };
}
const archivedExtra = (b: any) => (b.archived === undefined ? {} : { archived_at: b.archived ? new Date() : null });
const notFound = (res: Response) => res.status(404).json({ error: 'Not found.' });

// ---------- Dashboard ----------
dataRouter.get('/dashboard', wrap(async (_req, res) => {
  const out = await run(res, async (db) => {
    const c = await db.query(`select
      (select count(*) from subjects where archived_at is null)::int subjects,
      (select count(*) from batches where archived_at is null)::int batches,
      (select count(*) from projects where archived_at is null)::int projects,
      (select count(*) from teams where archived_at is null)::int teams,
      (select count(*) from hackathons where archived_at is null)::int hackathons,
      (select count(*) from teams where review_status='needs_review' and archived_at is null)::int needs_review`);
    const tree = await db.query(`select s.id sid, s.name sname, b.id bid, b.name bname, p.id pid, p.name pname,
      (select count(*) from project_teams pt where pt.project_id=p.id and pt.left_at is null)::int team_count
      from subjects s left join batches b on b.subject_id=s.id and b.archived_at is null
      left join projects p on p.batch_id=b.id and p.archived_at is null
      where s.archived_at is null order by s.name, b.name, p.name`);
    const hacks = await db.query(`select h.id, h.name, h.status, (select count(*) from hackathon_teams ht where ht.hackathon_id=h.id and ht.left_at is null)::int team_count
      from hackathons h where h.archived_at is null order by h.start_date desc nulls last limit 12`);
    const act = await db.query('select id, entity_type, action, after_data, created_at from audit_events order by created_at desc limit 8');
    return { counts: c.rows[0], tree: tree.rows, hackathons: hacks.rows, activity: act.rows };
  });
  res.json(out);
}));

dataRouter.get('/activity', wrap(async (_req, res) => {
  res.json(await run(res, async (db) => (await db.query('select id, entity_type, entity_id, action, after_data, created_at from audit_events order by created_at desc limit 100')).rows));
}));

// ---------- Subjects ----------
const subjectBody = z.object({ name: z.string().trim().min(1, 'Name is required.').max(160), course_code: opt(40), description: opt(2000), archived: z.boolean().optional() });
dataRouter.get('/subjects', wrap(async (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`; const arch = req.query.archived === 'true';
  res.json(await run(res, async (db) => (await db.query(`select s.*,
    (select count(*) from batches b where b.subject_id=s.id and b.archived_at is null)::int batch_count,
    (select count(*) from projects p join batches b on b.id=p.batch_id where b.subject_id=s.id and p.archived_at is null)::int project_count
    from subjects s where (s.name ilike $1 or coalesce(s.course_code,'') ilike $1) and (($2 and s.archived_at is not null) or (not $2 and s.archived_at is null)) order by s.name`, [q, arch])).rows));
}));
dataRouter.post('/subjects', wrap(async (req, res) => {
  const b = subjectBody.parse(req.body);
  res.status(201).json(await run(res, async (db, uid) => {
    const r = await db.query('insert into subjects(name,course_code,description) values ($1,$2,$3) returning *', [b.name, b.course_code, b.description]);
    await audit(db, uid, 'subject', r.rows[0].id, 'created', { name: b.name }); return r.rows[0];
  }));
}));
dataRouter.patch('/subjects/:id', wrap(async (req, res) => {
  const b = subjectBody.partial().parse(req.body); const sid = id.parse(req.params.id);
  const p = patchSql('subjects', ['name', 'course_code', 'description'], b, archivedExtra(b)); if (!p) return res.status(400).json({ error: 'Nothing to update.' });
  const row = await run(res, async (db, uid) => { const r = await db.query(p.sql, [sid, ...p.vals]); if (r.rows[0]) await audit(db, uid, 'subject', sid, b.archived === undefined ? 'updated' : b.archived ? 'archived' : 'restored'); return r.rows[0]; });
  row ? res.json(row) : notFound(res);
}));

// ---------- Batches ----------
const batchBody = z.object({ subject_id: id, name: z.string().trim().min(1, 'Name is required.').max(160), academic_year: opt(20), archived: z.boolean().optional() });
dataRouter.get('/batches', wrap(async (req, res) => {
  const sid = req.query.subject_id ? id.parse(req.query.subject_id) : null;
  res.json(await run(res, async (db) => (await db.query(`select b.*, s.name subject_name,
    (select count(*) from projects p where p.batch_id=b.id and p.archived_at is null)::int project_count
    from batches b join subjects s on s.id=b.subject_id where b.archived_at is null and ($1::uuid is null or b.subject_id=$1) order by s.name, b.name`, [sid])).rows));
}));
dataRouter.post('/batches', wrap(async (req, res) => {
  const b = batchBody.parse(req.body);
  res.status(201).json(await run(res, async (db, uid) => {
    const r = await db.query('insert into batches(subject_id,name,academic_year) values ($1,$2,$3) returning *', [b.subject_id, b.name, b.academic_year]);
    await audit(db, uid, 'batch', r.rows[0].id, 'created', { name: b.name }); return r.rows[0];
  }));
}));
dataRouter.patch('/batches/:id', wrap(async (req, res) => {
  const b = batchBody.partial().parse(req.body); const bid = id.parse(req.params.id);
  const p = patchSql('batches', ['name', 'academic_year'], b, archivedExtra(b)); if (!p) return res.status(400).json({ error: 'Nothing to update.' });
  const row = await run(res, async (db, uid) => { const r = await db.query(p.sql, [bid, ...p.vals]); if (r.rows[0]) await audit(db, uid, 'batch', bid, b.archived ? 'archived' : 'updated'); return r.rows[0]; });
  row ? res.json(row) : notFound(res);
}));

// ---------- Projects ----------
const projectBody = z.object({ batch_id: id, name: z.string().trim().min(1, 'Name is required.').max(200), description: opt(4000), problem_statement: opt(4000),
  repository_url: opt(500), start_date: date, due_date: date, status: z.enum(['planned', 'active', 'completed', 'archived']).optional(), archived: z.boolean().optional() });
dataRouter.get('/projects', wrap(async (req, res) => {
  const bid = req.query.batch_id ? id.parse(req.query.batch_id) : null; const q = `%${String(req.query.q ?? '').trim()}%`;
  res.json(await run(res, async (db) => (await db.query(`select p.*, b.name batch_name, s.name subject_name, s.id subject_id,
    (select count(*) from project_teams pt where pt.project_id=p.id and pt.left_at is null)::int team_count
    from projects p join batches b on b.id=p.batch_id join subjects s on s.id=b.subject_id
    where p.archived_at is null and ($1::uuid is null or p.batch_id=$1) and p.name ilike $2 order by p.created_at desc`, [bid, q])).rows));
}));
dataRouter.get('/projects/:id', wrap(async (req, res) => {
  const pid = id.parse(req.params.id);
  const out = await run(res, async (db) => {
    const p = await db.query(`select p.*, b.name batch_name, s.name subject_name, s.id subject_id from projects p join batches b on b.id=p.batch_id join subjects s on s.id=b.subject_id where p.id=$1`, [pid]);
    if (!p.rows[0]) return null;
    const teams = await db.query(`select t.id, t.team_code, t.name, t.leader_name, t.review_status, t.status from project_teams pt join teams t on t.id=pt.team_id where pt.project_id=$1 and pt.left_at is null order by t.name`, [pid]);
    const ms = await db.query('select * from milestones where project_id=$1 order by position, due_date', [pid]);
    return { ...p.rows[0], teams: teams.rows, milestones: ms.rows };
  });
  out ? res.json(out) : notFound(res);
}));
dataRouter.post('/projects', wrap(async (req, res) => {
  const b = projectBody.parse(req.body);
  res.status(201).json(await run(res, async (db, uid) => {
    const r = await db.query('insert into projects(batch_id,name,description,problem_statement,repository_url,start_date,due_date,status) values ($1,$2,$3,$4,$5,$6,$7,coalesce($8,\'active\')) returning *',
      [b.batch_id, b.name, b.description, b.problem_statement, b.repository_url, b.start_date || null, b.due_date || null, b.status ?? null]);
    await audit(db, uid, 'project', r.rows[0].id, 'created', { name: b.name }); return r.rows[0];
  }));
}));
dataRouter.patch('/projects/:id', wrap(async (req, res) => {
  const b = projectBody.partial().parse(req.body); const pid = id.parse(req.params.id);
  const p = patchSql('projects', ['name', 'description', 'problem_statement', 'repository_url', 'start_date', 'due_date', 'status'], { ...b, ...(b.start_date !== undefined ? { start_date: b.start_date || null } : {}), ...(b.due_date !== undefined ? { due_date: b.due_date || null } : {}) }, archivedExtra(b));
  if (!p) return res.status(400).json({ error: 'Nothing to update.' });
  const row = await run(res, async (db, uid) => { const r = await db.query(p.sql, [pid, ...p.vals]); if (r.rows[0]) await audit(db, uid, 'project', pid, b.archived ? 'archived' : 'updated'); return r.rows[0]; });
  row ? res.json(row) : notFound(res);
}));

// ---------- Teams ----------
const member = z.object({ full_name: z.string().trim().min(1).max(160), roll_number: opt(40), email: z.string().trim().toLowerCase().email().nullable().optional().or(z.literal('').transform(() => null)), role: z.enum(['leader', 'member']).default('member') });
const teamBody = z.object({ name: z.string().trim().min(1, 'Team name is required.').max(160), leader_name: opt(160), problem_statement: opt(4000), description: opt(4000),
  repository_url: opt(500), demo_url: opt(500), review_status: z.enum(['pending', 'approved', 'needs_review']).optional(), professor_notes: opt(4000), archived: z.boolean().optional() });
dataRouter.get('/teams', wrap(async (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`; const pid = req.query.project_id ? id.parse(req.query.project_id) : null; const hid = req.query.hackathon_id ? id.parse(req.query.hackathon_id) : null;
  const rs = req.query.review_status ? z.enum(['pending', 'approved', 'needs_review']).parse(req.query.review_status) : null;
  const limit = Math.min(Number(req.query.limit) || 50, 100); const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json(await run(res, async (db) => {
    const where = `t.archived_at is null and (t.name ilike $1 or t.team_code ilike $1 or coalesce(t.leader_name,'') ilike $1)
      and ($2::uuid is null or exists(select 1 from project_teams pt where pt.team_id=t.id and pt.project_id=$2 and pt.left_at is null))
      and ($3::uuid is null or exists(select 1 from hackathon_teams ht where ht.team_id=t.id and ht.hackathon_id=$3 and ht.left_at is null))
      and ($4::text is null or t.review_status=$4)`;
    const total = await db.query(`select count(*)::int n from teams t where ${where}`, [q, pid, hid, rs]);
    const rows = await db.query(`select t.id, t.team_code, t.name, t.leader_name, t.review_status, t.created_at,
      (select count(*) from team_members m where m.team_id=t.id)::int member_count,
      (select string_agg(p.name, ', ') from project_teams pt join projects p on p.id=pt.project_id where pt.team_id=t.id and pt.left_at is null) project_names,
      (select count(*) from hackathon_teams ht where ht.team_id=t.id and ht.left_at is null)::int hackathon_count
      from teams t where ${where} order by t.created_at desc limit $5 offset $6`, [q, pid, hid, rs, limit, offset]);
    return { total: total.rows[0].n, items: rows.rows };
  }));
}));
dataRouter.post('/teams', wrap(async (req, res) => {
  const b = teamBody.extend({ project_id: id.optional(), hackathon_id: id.optional(), members: z.array(member).max(12).default([]) }).parse(req.body);
  res.status(201).json(await run(res, async (db, uid) => {
    const code = (await db.query('select next_team_code() c')).rows[0].c;
    const t = (await db.query('insert into teams(team_code,name,leader_name,problem_statement,description,repository_url,demo_url) values ($1,$2,$3,$4,$5,$6,$7) returning *',
      [code, b.name, b.leader_name, b.problem_statement, b.description, b.repository_url, b.demo_url])).rows[0];
    for (const m of b.members) await db.query('insert into team_members(team_id,full_name,roll_number,email,role) values ($1,$2,$3,$4,$5)', [t.id, m.full_name, m.roll_number, m.email, m.role]);
    if (b.project_id) await db.query('insert into project_teams(project_id,team_id) values ($1,$2)', [b.project_id, t.id]);
    if (b.hackathon_id) await db.query('insert into hackathon_teams(hackathon_id,team_id) values ($1,$2)', [b.hackathon_id, t.id]);
    await audit(db, uid, 'team', t.id, 'created', { team_code: code, name: b.name }); return t;
  }));
}));
dataRouter.get('/teams/:id', wrap(async (req, res) => {
  const tid = id.parse(req.params.id);
  const out = await run(res, async (db) => {
    const t = await db.query('select * from teams where id=$1', [tid]); if (!t.rows[0]) return null;
    const [m, p, h, s] = await Promise.all([
      db.query('select * from team_members where team_id=$1 order by role, created_at', [tid]),
      db.query(`select p.id, p.name, b.name batch_name, sj.name subject_name from project_teams pt join projects p on p.id=pt.project_id join batches b on b.id=p.batch_id join subjects sj on sj.id=b.subject_id where pt.team_id=$1 and pt.left_at is null`, [tid]),
      db.query(`select h.id, h.name, h.status, ht.registration_status from hackathon_teams ht join hackathons h on h.id=ht.hackathon_id where ht.team_id=$1 and ht.left_at is null`, [tid]),
      db.query(`select ms.id, ms.status, ms.submitted_at, ms.response_data, m.name milestone_name from milestone_submissions ms join milestones m on m.id=ms.milestone_id where ms.team_id=$1 and ms.source_deleted_at is null order by ms.submitted_at desc nulls last`, [tid]),
    ]);
    return { ...t.rows[0], members: m.rows, projects: p.rows, hackathons: h.rows, submissions: s.rows };
  });
  out ? res.json(out) : notFound(res);
}));
dataRouter.patch('/teams/:id', wrap(async (req, res) => {
  const b = teamBody.partial().parse(req.body); const tid = id.parse(req.params.id);
  const row = await run(res, async (db, uid) => {
    const cur = await db.query('select professor_overrides from teams where id=$1', [tid]); if (!cur.rows[0]) return null;
    // Fields the professor edits are remembered so a later sync never overwrites them.
    const imp = ['name', 'leader_name', 'problem_statement', 'description', 'repository_url', 'demo_url'].filter((k) => (b as any)[k] !== undefined);
    const overrides = { ...cur.rows[0].professor_overrides, ...Object.fromEntries(imp.map((k) => [k, true])) };
    const p = patchSql('teams', ['name', 'leader_name', 'problem_statement', 'description', 'repository_url', 'demo_url', 'review_status', 'professor_notes'], b, { ...archivedExtra(b), ...(imp.length ? { professor_overrides: JSON.stringify(overrides) } : {}), ...(b.archived ? { status: 'archived' } : b.archived === false ? { status: 'active' } : {}) });
    if (!p) return undefined;
    const r = await db.query(p.sql, [tid, ...p.vals]); await audit(db, uid, 'team', tid, b.archived ? 'archived' : 'updated', Object.keys(b)); return r.rows[0];
  });
  row === undefined ? res.status(400).json({ error: 'Nothing to update.' }) : row ? res.json(row) : notFound(res);
}));
dataRouter.post('/teams/:id/members', wrap(async (req, res) => {
  const m = member.parse(req.body); const tid = id.parse(req.params.id);
  res.status(201).json(await run(res, async (db, uid) => { const r = await db.query('insert into team_members(team_id,full_name,roll_number,email,role) values ($1,$2,$3,$4,$5) returning *', [tid, m.full_name, m.roll_number, m.email, m.role]); await audit(db, uid, 'team', tid, 'member_added'); return r.rows[0]; }));
}));
dataRouter.delete('/teams/:id/members/:mid', wrap(async (req, res) => {
  const tid = id.parse(req.params.id), mid = id.parse(req.params.mid);
  await run(res, async (db, uid) => { await db.query('delete from team_members where id=$1 and team_id=$2', [mid, tid]); await audit(db, uid, 'team', tid, 'member_removed'); });
  res.json({ ok: true });
}));
dataRouter.post('/teams/:id/projects', wrap(async (req, res) => {
  const tid = id.parse(req.params.id); const pid = id.parse(req.body?.project_id);
  await run(res, async (db, uid) => { await db.query('insert into project_teams(project_id,team_id) values ($1,$2)', [pid, tid]); await audit(db, uid, 'team', tid, 'project_assigned', { project_id: pid }); });
  res.status(201).json({ ok: true });
}));
dataRouter.post('/teams/:id/hackathons', wrap(async (req, res) => {
  const tid = id.parse(req.params.id); const hid = id.parse(req.body?.hackathon_id);
  await run(res, async (db, uid) => { await db.query('insert into hackathon_teams(hackathon_id,team_id) values ($1,$2)', [hid, tid]); await audit(db, uid, 'team', tid, 'hackathon_joined', { hackathon_id: hid }); });
  res.status(201).json({ ok: true });
}));
dataRouter.delete('/teams/:id/hackathons/:hid', wrap(async (req, res) => {
  const tid = id.parse(req.params.id), hid = id.parse(req.params.hid);
  await run(res, async (db, uid) => { await db.query('update hackathon_teams set left_at=now() where team_id=$1 and hackathon_id=$2 and left_at is null', [tid, hid]); await audit(db, uid, 'team', tid, 'hackathon_left', { hackathon_id: hid }); });
  res.json({ ok: true });
}));

// ---------- Hackathons ----------
const hackBody = z.object({ name: z.string().trim().min(1, 'Name is required.').max(200), organizer: opt(160), description: opt(4000), registration_url: opt(500), start_date: date, end_date: date,
  status: z.enum(['upcoming', 'active', 'completed', 'archived']).optional(), archived: z.boolean().optional() });
dataRouter.get('/hackathons', wrap(async (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`; const st = req.query.status ? String(req.query.status) : null;
  res.json(await run(res, async (db) => (await db.query(`select h.*, (select count(*) from hackathon_teams ht where ht.hackathon_id=h.id and ht.left_at is null)::int team_count
    from hackathons h where h.archived_at is null and (h.name ilike $1 or coalesce(h.organizer,'') ilike $1) and ($2::text is null or h.status=$2) order by h.start_date desc nulls last, h.created_at desc`, [q, st])).rows));
}));
dataRouter.post('/hackathons', wrap(async (req, res) => {
  const b = hackBody.parse(req.body);
  res.status(201).json(await run(res, async (db, uid) => {
    const r = await db.query("insert into hackathons(name,organizer,description,registration_url,start_date,end_date,status) values ($1,$2,$3,$4,$5,$6,coalesce($7,'upcoming')) returning *",
      [b.name, b.organizer, b.description, b.registration_url, b.start_date || null, b.end_date || null, b.status ?? null]);
    await audit(db, uid, 'hackathon', r.rows[0].id, 'created', { name: b.name }); return r.rows[0];
  }));
}));
dataRouter.get('/hackathons/:id', wrap(async (req, res) => {
  const hid = id.parse(req.params.id);
  const out = await run(res, async (db) => {
    const h = await db.query('select * from hackathons where id=$1', [hid]); if (!h.rows[0]) return null;
    const t = await db.query(`select t.id, t.team_code, t.name, t.leader_name, ht.registration_status from hackathon_teams ht join teams t on t.id=ht.team_id where ht.hackathon_id=$1 and ht.left_at is null order by t.name`, [hid]);
    return { ...h.rows[0], teams: t.rows };
  });
  out ? res.json(out) : notFound(res);
}));
dataRouter.patch('/hackathons/:id', wrap(async (req, res) => {
  const b = hackBody.partial().parse(req.body); const hid = id.parse(req.params.id);
  const p = patchSql('hackathons', ['name', 'organizer', 'description', 'registration_url', 'start_date', 'end_date', 'status'], { ...b, ...(b.start_date !== undefined ? { start_date: b.start_date || null } : {}), ...(b.end_date !== undefined ? { end_date: b.end_date || null } : {}) }, archivedExtra(b));
  if (!p) return res.status(400).json({ error: 'Nothing to update.' });
  const row = await run(res, async (db, uid) => { const r = await db.query(p.sql, [hid, ...p.vals]); if (r.rows[0]) await audit(db, uid, 'hackathon', hid, b.archived ? 'archived' : 'updated'); return r.rows[0]; });
  row ? res.json(row) : notFound(res);
}));

// ---------- Forms & sync (read + register; live ingest not built yet) ----------
dataRouter.get('/forms', wrap(async (_req, res) => {
  res.json(await run(res, async (db) => (await db.query(`select f.id, f.label, f.purpose, f.form_url, f.sync_enabled, f.last_synced_at, p.name project_name, h.name hackathon_name,
    (select row_to_json(r) from (select status, rows_seen, created_count, updated_count, unchanged_count, error_count, started_at from sync_runs sr where sr.form_source_id=f.id order by started_at desc limit 1) r) last_run
    from form_sources f left join projects p on p.id=f.project_id left join hackathons h on h.id=f.hackathon_id order by f.created_at desc`)).rows));
}));
dataRouter.post('/forms', wrap(async (req, res) => {
  const b = z.object({ label: z.string().trim().min(1).max(160), purpose: z.enum(['registration', 'milestone', 'final', 'custom']), form_url: opt(500), project_id: id.optional(), hackathon_id: id.optional() })
    .refine((v) => !!v.project_id !== !!v.hackathon_id, { message: 'Choose a project or a hackathon.' }).parse(req.body);
  res.status(201).json(await run(res, async (db, uid) => {
    const r = await db.query('insert into form_sources(label,purpose,form_url,project_id,hackathon_id) values ($1,$2,$3,$4,$5) returning *', [b.label, b.purpose, b.form_url, b.project_id ?? null, b.hackathon_id ?? null]);
    await audit(db, uid, 'form_source', r.rows[0].id, 'connected', { label: b.label }); return r.rows[0];
  }));
}));
dataRouter.get('/sync/runs', wrap(async (_req, res) => {
  res.json(await run(res, async (db) => (await db.query(`select sr.*, f.label from sync_runs sr join form_sources f on f.id=sr.form_source_id order by sr.started_at desc limit 50`)).rows));
}));

// Integration tests for db/migrations/0001_schema.sql. They need a real PostgreSQL 13+ server and are skipped without one:
//   DATABASE_ADMIN_URL=postgres://postgres:...@localhost:5432/scratch_db npm run test:db
// Use a throwaway database: the test applies the migration into a fresh schema-less DB and removes its own users afterwards.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_ADMIN_URL;
const pg = url ? (await import('pg')).default : null;
const opts = { skip: url ? false : 'DATABASE_ADMIN_URL not set' };

test('schema: migration applies, RLS isolates owners, cross-tenant links and team_code edits are rejected', opts, async () => {
  const admin = new pg!.Client({ connectionString: url }); await admin.connect();
  try {
    await admin.query(readFileSync(new URL('../../db/migrations/0001_schema.sql', import.meta.url), 'utf8'));
    const a = (await admin.query("insert into users(email,password_hash) values ('a@x.edu','h') returning id")).rows[0].id;
    const b = (await admin.query("insert into users(email,password_hash) values ('b@x.edu','h') returning id")).rows[0].id;
    await admin.query('insert into profiles(id) values ($1),($2)', [a, b]);

    const as = async (uid: string, sql: string, params: unknown[] = []) => {
      await admin.query('begin'); await admin.query('set local role projecttrack_app');
      await admin.query("select set_config('app.current_user_id', $1, true)", [uid]);
      try { const r = await admin.query(sql, params); await admin.query('commit'); return r.rows; }
      catch (e) { await admin.query('rollback'); throw e; }
    };

    const code = (await as(a, 'select next_team_code() as c'))[0].c; assert.equal(code, 'PT-000001');
    assert.equal((await as(a, 'select next_team_code() as c'))[0].c, 'PT-000002');
    assert.equal((await as(b, 'select next_team_code() as c'))[0].c, 'PT-000001', 'counters are per owner');

    const team = (await as(a, "insert into teams(team_code,name) values ($1,'Alpha') returning id", [code]))[0].id;
    assert.equal((await as(b, 'select * from teams')).length, 0, 'owner B cannot see owner A rows');
    assert.equal((await as(a, 'select * from teams')).length, 1);
    await assert.rejects(as(b, "insert into teams(owner_id,team_code,name) values ($1,'PT-000009','X')", [a]), /row-level security/);
    await assert.rejects(as(a, "update teams set team_code='PT-000777' where id=$1", [team]), /immutable/);
    await assert.rejects(as(b, "insert into team_members(team_id,full_name) values ($1,'Intruder')", [team]), /different owner/);
    await assert.rejects(as(a, 'select * from users'), /permission denied/);
    await assert.rejects(as(a, 'select * from form_source_secrets'), /permission denied/);
    await admin.query('begin'); await admin.query('set local role projecttrack_app');
    await assert.rejects(admin.query('select next_team_code()'), /no current user/); await admin.query('rollback');
  } finally {
    await admin.query('delete from users').catch(() => {}); await admin.end();
  }
});

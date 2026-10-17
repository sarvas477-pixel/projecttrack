// Demo data for ONE existing professor:  npm run seed -- you@college.edu
// Runs as projecttrack_app through withUser, so it is subject to the same RLS as the API. Rows are labelled "(demo)".
import { withUser, pool } from '../src/db/client.ts';
import pg from 'pg';
const email = process.argv[2]?.toLowerCase(); if (!email) { console.error('Usage: npm run seed -- <professor-email>'); process.exit(1); }
const admin = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const u = await admin.query('select id from users where lower(email)=$1', [email]); await admin.end();
if (!u.rows[0]) { console.error('No professor with that email. Register in the app first.'); process.exit(1); }
await withUser(u.rows[0].id, async (db) => {
  const s = (await db.query("insert into subjects(name,course_code,description) values ('Artificial Intelligence (demo)','CSE-AI-201','Demo subject') returning id")).rows[0].id;
  const b = (await db.query("insert into batches(subject_id,name,academic_year) values ($1,'Batch A','2026-27') returning id", [s])).rows[0].id;
  const p = (await db.query("insert into projects(batch_id,name,description,due_date) values ($1,'Capstone Sprint (demo)','Demo project', current_date + 30) returning id", [b])).rows[0].id;
  const h = (await db.query("insert into hackathons(name,organizer,start_date,end_date,status) values ('Demo Hack 2026','Demo Org', current_date + 10, current_date + 12,'upcoming') returning id")).rows[0].id;
  for (const [name, leader] of [['Team Alpha (demo)', 'Asha Rao'], ['Team Beta (demo)', 'Ravi Menon']]) {
    const code = (await db.query('select next_team_code() c')).rows[0].c;
    const t = (await db.query('insert into teams(team_code,name,leader_name) values ($1,$2,$3) returning id', [code, name, leader])).rows[0].id;
    await db.query("insert into team_members(team_id,full_name,role) values ($1,$2,'leader')", [t, leader]);
    await db.query('insert into project_teams(project_id,team_id) values ($1,$2)', [p, t]);
    if (name.includes('Alpha')) await db.query('insert into hackathon_teams(hackathon_id,team_id) values ($1,$2)', [h, t]);
  }
});
await pool.end(); console.log('Demo data added.');

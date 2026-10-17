-- ProjectTrack core schema for plain PostgreSQL (13+; gen_random_uuid() is built in).
-- Tenant isolation: the API opens a transaction, runs  SELECT set_config('app.current_user_id', '<uuid>', true)
-- and every row-level-security policy compares owner_id with app_user_id(). RLS only binds NON-owner roles, so the
-- API must connect as projecttrack_app (created at the bottom), never as the role that owns the tables.

create table users (id uuid primary key default gen_random_uuid(), email text not null, password_hash text not null,
  created_at timestamptz not null default now());
create unique index users_email_key on users (lower(email));

create or replace function app_user_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid $$;

create table profiles (id uuid primary key references users on delete cascade, display_name text, institution text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table team_counters (owner_id uuid primary key references profiles on delete cascade, last_value int not null default 0);

-- Always allocates for the current user; the old p_owner argument let any caller bump another tenant's counter.
create or replace function next_team_code() returns text language plpgsql security definer set search_path = public as $$
declare n int; uid uuid := app_user_id(); begin
  if uid is null then raise exception 'no current user'; end if;
  insert into team_counters(owner_id,last_value) values (uid,1)
  on conflict (owner_id) do update set last_value = team_counters.last_value + 1 returning last_value into n;
  return 'PT-' || lpad(n::text,6,'0'); end $$;

create table subjects (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  name text not null check (length(trim(name))>0), course_code text, description text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table batches (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  subject_id uuid not null references subjects on delete restrict, name text not null check (length(trim(name))>0), academic_year text,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table projects (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  batch_id uuid not null references batches on delete restrict, name text not null check (length(trim(name))>0), description text,
  problem_statement text, repository_url text, start_date date, due_date date,
  status text not null default 'active' check (status in ('planned','active','completed','archived')),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table teams (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  team_code text not null, name text not null check (length(trim(name))>0), leader_name text, problem_statement text, description text,
  repository_url text, demo_url text, status text not null default 'active' check (status in ('active','archived')),
  review_status text not null default 'pending' check (review_status in ('pending','approved','needs_review')),
  professor_notes text, professor_overrides jsonb not null default '{}',  -- fields the professor edited; sync must not overwrite
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (owner_id, team_code));
create table team_members (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  team_id uuid not null references teams on delete cascade, full_name text not null, roll_number text, email text,
  role text not null default 'member' check (role in ('leader','member')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table hackathons (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  name text not null check (length(trim(name))>0), organizer text, description text, problem_statement text,
  start_date date, end_date date check (end_date is null or start_date is null or end_date >= start_date), registration_url text,
  status text not null default 'upcoming' check (status in ('upcoming','active','completed','archived')),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table project_teams (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  project_id uuid not null references projects, team_id uuid not null references teams,
  joined_at timestamptz not null default now(), left_at timestamptz);
create unique index project_teams_active on project_teams(project_id, team_id) where left_at is null;
create table hackathon_teams (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  hackathon_id uuid not null references hackathons, team_id uuid not null references teams, registration_status text, result text,
  joined_at timestamptz not null default now(), left_at timestamptz);
create unique index hackathon_teams_active on hackathon_teams(hackathon_id, team_id) where left_at is null;

create table milestones (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  project_id uuid references projects, hackathon_id uuid references hackathons, name text not null, description text, due_date date,
  position int not null default 0, created_at timestamptz not null default now(),
  check ((project_id is null) <> (hackathon_id is null)));

create table form_sources (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  project_id uuid references projects, hackathon_id uuid references hackathons, milestone_id uuid references milestones,
  label text not null, purpose text not null default 'registration' check (purpose in ('registration','milestone','final','custom')),
  form_url text, worksheet_name text, source_type text not null default 'google_sheets', mapping_json jsonb not null default '{}',
  sync_enabled boolean not null default false, last_synced_at timestamptz, last_attempted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((project_id is null) <> (hackathon_id is null)));
-- spreadsheet_id and the push-secret hash live where the browser cannot read them (RLS on, no policy)
create table form_source_secrets (form_source_id uuid primary key references form_sources on delete cascade,
  owner_id uuid not null, spreadsheet_id text, push_secret_hash text);

create table milestone_submissions (id uuid primary key default gen_random_uuid(), owner_id uuid not null default app_user_id() references profiles,
  team_id uuid not null references teams, milestone_id uuid not null references milestones, form_source_id uuid references form_sources,
  source_response_key text, submitted_at timestamptz, status text not null default 'received' check (status in ('received','needs_review','accepted','rejected')),
  response_data jsonb not null default '{}', source_fingerprint text, source_deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index submissions_idempotent on milestone_submissions(form_source_id, source_response_key) where source_response_key is not null;

create table sync_runs (id uuid primary key default gen_random_uuid(), owner_id uuid not null, form_source_id uuid not null references form_sources,
  started_at timestamptz not null default now(), finished_at timestamptz, status text not null default 'running' check (status in ('running','success','partial','failed')),
  rows_seen int not null default 0, created_count int not null default 0, updated_count int not null default 0, unchanged_count int not null default 0,
  ignored_count int not null default 0, error_count int not null default 0, summary text);
create table sync_row_errors (id uuid primary key default gen_random_uuid(), owner_id uuid not null, sync_run_id uuid not null references sync_runs on delete cascade,
  source_response_key text, row_reference text, error_code text not null, message text not null, raw_data jsonb, resolved_at timestamptz, created_at timestamptz not null default now());
create table audit_events (id uuid primary key default gen_random_uuid(), owner_id uuid not null, actor_id uuid, entity_type text not null, entity_id uuid,
  action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());

create index on batches(subject_id); create index on projects(batch_id); create index on team_members(team_id);
create index on milestone_submissions(team_id, milestone_id); create index on sync_runs(form_source_id, started_at desc);

create or replace function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create or replace function lock_team_code() returns trigger language plpgsql as $$ begin
  if new.team_code is distinct from old.team_code then raise exception 'team_code is immutable'; end if; return new; end $$;
create trigger teams_lock_code before update on teams for each row execute function lock_team_code();

do $$ declare t text; begin
  foreach t in array array['profiles','subjects','batches','projects','teams','team_members','hackathons','project_teams','hackathon_teams',
    'milestones','form_sources','milestone_submissions','sync_runs','sync_row_errors','audit_events','team_counters'] loop
    execute format('alter table %I enable row level security', t);
    if t = 'profiles' then
      execute 'create policy own_profile on profiles for all using (id = app_user_id()) with check (id = app_user_id())';
    else
      execute format('create policy own_rows on %I for all using (owner_id = app_user_id()) with check (owner_id = app_user_id())', t);
    end if;
    if t in ('subjects','batches','projects','teams','team_members','hackathons','milestone_submissions','profiles','form_sources') then
      execute format('create trigger touch before update on %I for each row execute function touch_updated_at()', t);
    end if;
  end loop;
end $$;
alter table form_source_secrets enable row level security;

-- Child rows may only link to parents with the same owner (blocks cross-tenant linking via guessed UUIDs)
create or replace function assert_same_owner() returns trigger language plpgsql as $$ declare ok boolean; begin
  if tg_table_name = 'batches' then select owner_id = new.owner_id into ok from subjects where id = new.subject_id;
  elsif tg_table_name = 'projects' then select owner_id = new.owner_id into ok from batches where id = new.batch_id;
  elsif tg_table_name = 'team_members' then select owner_id = new.owner_id into ok from teams where id = new.team_id;
  elsif tg_table_name = 'project_teams' then
    ok := (select owner_id from projects where id=new.project_id)=new.owner_id and (select owner_id from teams where id=new.team_id)=new.owner_id;
  elsif tg_table_name = 'hackathon_teams' then
    ok := (select owner_id from hackathons where id=new.hackathon_id)=new.owner_id and (select owner_id from teams where id=new.team_id)=new.owner_id;
  elsif tg_table_name = 'milestones' then
    ok := coalesce((select owner_id from projects where id=new.project_id),(select owner_id from hackathons where id=new.hackathon_id)) = new.owner_id;
  elsif tg_table_name = 'form_sources' then
    ok := (new.project_id is null or (select owner_id from projects where id=new.project_id)=new.owner_id)
      and (new.hackathon_id is null or (select owner_id from hackathons where id=new.hackathon_id)=new.owner_id)
      and (new.milestone_id is null or (select owner_id from milestones where id=new.milestone_id)=new.owner_id);
  elsif tg_table_name = 'milestone_submissions' then
    ok := (select owner_id from teams where id=new.team_id)=new.owner_id
      and (select owner_id from milestones where id=new.milestone_id)=new.owner_id
      and (new.form_source_id is null or (select owner_id from form_sources where id=new.form_source_id)=new.owner_id);
  end if;
  if ok is not true then raise exception 'parent record belongs to a different owner'; end if; return new; end $$;
create trigger own_chk before insert or update on batches for each row execute function assert_same_owner();
create trigger own_chk before insert or update on projects for each row execute function assert_same_owner();
create trigger own_chk before insert or update on team_members for each row execute function assert_same_owner();
create trigger own_chk before insert or update on project_teams for each row execute function assert_same_owner();
create trigger own_chk before insert or update on hackathon_teams for each row execute function assert_same_owner();
create trigger own_chk before insert or update on milestones for each row execute function assert_same_owner();
create trigger own_chk before insert or update on form_sources for each row execute function assert_same_owner();
create trigger own_chk before insert or update on milestone_submissions for each row execute function assert_same_owner();

-- Application role: subject to RLS (not the table owner, not BYPASSRLS). Set its password outside migrations:
--   ALTER ROLE projecttrack_app PASSWORD '...';
-- It gets no access to users or form_source_secrets; login, sign-up and the sheet-sync ingest run on a separate server-side connection.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'projecttrack_app') then create role projecttrack_app login; end if;
end $$;
grant usage on schema public to projecttrack_app;
grant select, insert, update, delete on profiles, team_counters, subjects, batches, projects, teams, team_members, hackathons, project_teams,
  hackathon_teams, milestones, form_sources, milestone_submissions, sync_runs, sync_row_errors, audit_events to projecttrack_app;
grant execute on function app_user_id(), next_team_code() to projecttrack_app;

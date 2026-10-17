
create table registration_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles,
  form_source_id uuid not null references form_sources on delete cascade,
  source_response_key text not null,
  team_id uuid not null references teams on delete cascade,
  source_fingerprint text not null,
  source_row text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_source_id, source_response_key)
);

alter table registration_imports enable row level security;

create policy own_rows on registration_imports
  for all
  using (owner_id = app_user_id())
  with check (owner_id = app_user_id());

grant select, insert, update, delete
  on registration_imports to projecttrack_app;


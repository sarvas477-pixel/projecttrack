# ProjectTrack

Professor workspace for academic projects, teams, hackathons and form-based milestones.
React 19 + Vite + Tailwind (spatial UI) -> `/api` proxy -> Express -> PostgreSQL with row-level security.

## Run it (first time)
1. `npm install`
2. Create the database and role (as the postgres superuser):
   `createdb projecttrack` then, inside psql: `ALTER ROLE projecttrack_app PASSWORD '...'` after step 4 (the migration creates the role).
3. Copy `.env.example` to `.env` and fill it in:
   - `DATABASE_URL`  = connects as `projecttrack_app` (RLS applies)
   - `DATABASE_ADMIN_URL` = connects as the owner (migrations, login, sessions only)
   - **If a password contains `@`, `:`, `/` or `#`, URL-encode it** (`@` becomes `%40`). An unencoded `@` makes the URL unparseable and every API call fails.
4. `npm run db:migrate` (applies 0001 and 0002)
5. Terminal A: `npm run dev:api` (port 3001). Terminal B: `npm run dev` (port 5173).
6. Open http://localhost:5173, choose "Create an account". Set `ALLOW_REGISTRATION=false` in `.env` afterwards to close sign-up.
7. Optional demo data: `npm run seed -- you@college.edu` (rows are labelled "(demo)").

## Checks
`npm run build` (typecheck + bundle), `npm run test:engine`, `npm run test:db` (needs a throwaway database).

## Troubleshooting
- Dashboard shows "The API is not responding": API not running, or `GET http://localhost:3001/api/health` returns `database: down` (check `DATABASE_URL`, the role password, and that migrations ran).
- "permission denied for table": migrations were not run, or `DATABASE_URL` points at the wrong role.
- Login works but data is empty: you are on a different professor account than the one the data was created under (data is private per account).

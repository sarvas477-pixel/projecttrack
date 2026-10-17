# Status

## Done (written, NOT yet executed: the authoring sandbox had no network, no npm install, no Postgres)
- API: auth (register/login/logout/me, scrypt hashing, server-side sessions, HttpOnly cookie, CSRF header guard, login rate limit), dashboard, activity, subjects, batches, projects, teams (+members, project/hackathon links), hackathons, forms (register/list), sync runs (read).
- Every data query runs through `withUser()` as `projecttrack_app`; the admin connection is used only for users/sessions.
- Frontend: spatial UI (glass layers, floating dock, pannable map of real data), login, overview, academics drill-down, project detail, teams directory + profile, hackathons + detail, forms, activity, settings, 404, light/dark.

## Not built
- Live Google Sheets / Apps Script ingest, CSV import, sync preview, milestone matching endpoint (pure logic exists in `src/features/sync/engine.ts` and is unit tested).
- Milestone creation UI, notifications beyond the audit feed, frontend and API integration tests, Playwright e2e.

## First thing to do
`npm install`, `npm run build`, fix any type errors, then run the steps in README.

import pg from 'pg';
export { pool, withUser } from '../src/db/client.ts';
// Trusted connection: ONLY for login, registration lookups and sessions. Never used for ordinary data queries.
export const adminPool = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

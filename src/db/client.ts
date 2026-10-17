// Plain PostgreSQL access (node-postgres). The API connects as the non-owner role projecttrack_app so row-level security applies;
// every request runs inside a transaction that first sets app.current_user_id (read by app_user_id() in the schema).
import pg from 'pg';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function withUser<T>(userId: string, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!uuid.test(userId)) throw new Error('withUser: userId must be a UUID');
  const db = await pool.connect();
  try {
    await db.query('begin');
    await db.query("select set_config('app.current_user_id', $1, true)", [userId]); // true = local to this transaction
    const out = await fn(db);
    await db.query('commit');
    return out;
  } catch (e) {
    await db.query('rollback').catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}

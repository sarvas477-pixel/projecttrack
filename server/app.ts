import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { pool } from './db.ts';
import { csrfGuard, requireAuth } from './auth.ts';
import { authRouter } from './routes/auth.ts';
import { dataRouter } from './routes/data.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', csrfGuard);
  app.get('/api/health', async (_req, res) => {
    try { await pool.query('select 1'); res.json({ ok: true, database: 'up' }); } catch { res.status(503).json({ ok: false, database: 'down' }); }
  });
  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth, dataRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input.', fields: err.flatten().fieldErrors });
    const code = err?.code as string | undefined;
    if (code === '23505') return res.status(409).json({ error: 'That already exists.' });
    if (code === '23503') return res.status(409).json({ error: 'This record is linked to other data.' });
    if (code === '23514' || code === '22P02' || code === '22007') return res.status(400).json({ error: 'One of the values is not valid.' });
    if (code === 'P0001') return res.status(400).json({ error: 'That change is not allowed.' });
    console.error('[api]', req_id(), code ?? '', err?.message); // never log bodies, cookies or stacks to the client
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
  return app;
}
const req_id = () => new Date().toISOString();

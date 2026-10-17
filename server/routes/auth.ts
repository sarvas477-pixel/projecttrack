import { Router } from 'express';
import { z } from 'zod';
import { adminPool, withUser } from '../db.ts';
import { createSession, destroySession, hashPassword, loginLimiter, requireAuth, verifyPassword } from '../auth.ts';

export const authRouter = Router();
const cred = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(10, 'Use at least 10 characters.').max(200) });

authRouter.post('/register', async (req, res, next) => {
  try {
    // Open sign-up can be switched off after the first professor exists: ALLOW_REGISTRATION=false
    if (process.env.ALLOW_REGISTRATION === 'false') return res.status(403).json({ error: 'Registration is closed.' });
    const body = cred.extend({ display_name: z.string().trim().min(1).max(120), institution: z.string().trim().max(160).optional() }).parse(req.body);
    const exists = await adminPool.query('select 1 from users where lower(email)=$1', [body.email]);
    if (exists.rowCount) return res.status(409).json({ error: 'An account with this email already exists.' });
    const u = await adminPool.query('insert into users(email,password_hash) values ($1,$2) returning id', [body.email, hashPassword(body.password)]);
    const id = u.rows[0].id as string;
    await withUser(id, (db) => db.query('insert into profiles(id,display_name,institution) values ($1,$2,$3)', [id, body.display_name, body.institution ?? null]));
    await createSession(id, res);
    res.status(201).json({ id, email: body.email, display_name: body.display_name });
  } catch (e) { next(e); }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(req.body);
    if (!loginLimiter(`${req.ip}|${body.email}`)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    const r = await adminPool.query('select id, password_hash from users where lower(email)=$1', [body.email]);
    const row = r.rows[0];
    // Same message for unknown email and wrong password
    if (!row || !verifyPassword(body.password, row.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await createSession(row.id, res);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

authRouter.post('/logout', async (req, res, next) => { try { await destroySession(req, res); res.json({ ok: true }); } catch (e) { next(e); } });

authRouter.get('/me', requireAuth, async (_req, res, next) => {
  try {
    const p = await withUser(res.locals.userId, (db) => db.query('select display_name, institution from profiles where id=$1', [res.locals.userId]));
    res.json({ id: res.locals.userId, email: res.locals.email, display_name: p.rows[0]?.display_name ?? null, institution: p.rows[0]?.institution ?? null });
  } catch (e) { next(e); }
});

authRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const b = z.object({ display_name: z.string().trim().min(1).max(120), institution: z.string().trim().max(160).nullable().optional() }).parse(req.body);
    await withUser(res.locals.userId, (db) => db.query('update profiles set display_name=$2, institution=$3 where id=$1', [res.locals.userId, b.display_name, b.institution ?? null]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

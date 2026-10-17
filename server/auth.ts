import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { adminPool } from './db.ts';

export const COOKIE = 'pt_session';
const SESSION_DAYS = 7;

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, s, h] = stored.split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const expected = Buffer.from(h, 'base64');
  const actual = crypto.scryptSync(pw, Buffer.from(s, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}
const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export async function createSession(userId: string, res: Response) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await adminPool.query('insert into sessions(token_hash,user_id,expires_at) values ($1,$2,$3)', [sha(token), userId, expires]);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires });
}
export async function destroySession(req: Request, res: Response) {
  const t = readCookie(req, COOKIE);
  if (t) await adminPool.query('delete from sessions where token_hash=$1', [sha(t)]);
  res.clearCookie(COOKIE, { path: '/' });
}
export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie; if (!raw) return;
  for (const part of raw.split(';')) { const i = part.indexOf('='); if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim()); }
}

/** Resolves the professor from the server-side session; the browser never supplies an owner id. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const t = readCookie(req, COOKIE);
    if (!t) return res.status(401).json({ error: 'Sign in to continue.' });
    const r = await adminPool.query('select s.user_id, u.email from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()', [sha(t)]);
    if (!r.rows[0]) { res.clearCookie(COOKIE, { path: '/' }); return res.status(401).json({ error: 'Your session expired. Sign in again.' }); }
    res.locals.userId = r.rows[0].user_id; res.locals.email = r.rows[0].email;
    next();
  } catch (e) { next(e); }
}

/** CSRF: cookies are SameSite=Lax, CORS is off, and every state-changing request must carry a custom header a cross-site form cannot send. */
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-requested-with'] !== 'projecttrack') return res.status(403).json({ error: 'Request blocked.' });
  next();
}

const attempts = new Map<string, { n: number; reset: number }>();
export function loginLimiter(key: string): boolean {
  const now = Date.now(); const a = attempts.get(key);
  if (!a || a.reset < now) { attempts.set(key, { n: 1, reset: now + 15 * 60e3 }); return true; }
  a.n++; return a.n <= 10;
}

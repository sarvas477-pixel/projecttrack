import { useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../services/api';
import { Field } from '../components/ui';

export default function Login() {
  const { refresh } = useAuth(); const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ display_name: '', institution: '', email: '', password: '' }); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.post(mode === 'login' ? '/auth/login' : '/auth/register', mode === 'login' ? { email: f.email, password: f.password } : f); await refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : 'Could not sign in.'); } finally { setBusy(false); }
  }
  return (
    <div className="grid min-h-full place-items-center p-4">
      <div className="space-bg" aria-hidden><i /><i /><i /></div>
      <form onSubmit={submit} className="glass glass-strong rise w-full max-w-md p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">ProjectTrack</h1>
        <p className="muted mb-6 mt-1 text-sm">{mode === 'login' ? 'Sign in to your professor workspace.' : 'Create your professor workspace.'}</p>
        {mode === 'register' && <><Field label="Your name"><input className="input" required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
          <Field label="Institution (optional)"><input className="input" value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} /></Field></>}
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 10 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />{mode === 'register' && <span className="muted text-xs">At least 10 characters.</span>}</Field>
        {err && <p role="alert" className="mb-3 text-sm" style={{ color: 'var(--rose)' }}>{err}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="muted mt-4 w-full text-center text-sm underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(null); }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
      </form>
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';

export const Panel = ({ children, className = '', ...r }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => <div className={`glass ${className}`} {...r}>{children}</div>;

export function PageHead({ title, sub, crumbs, actions }: { title: string; sub?: string; crumbs?: { to?: string; label: string }[]; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 rise">
      <div>
        {crumbs && <nav aria-label="Breadcrumb" className="muted mb-1 flex flex-wrap gap-1 text-sm">{crumbs.map((c, i) => <span key={i}>{c.to ? <Link className="hover:underline" to={c.to}>{c.label}</Link> : c.label}{i < crumbs.length - 1 && <span aria-hidden> / </span>}</span>)}</nav>}
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="muted mt-1 max-w-xl text-sm">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </header>
  );
}

export const Loading = ({ rows = 3 }: { rows?: number }) => <div role="status" aria-label="Loading" className="grid gap-3">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>;

export const ErrorState = ({ message, retry }: { message: string; retry?: () => void }) => (
  <Panel className="flex items-start gap-3 p-5" role="alert"><AlertTriangle className="mt-0.5 shrink-0" style={{ color: 'var(--rose)' }} size={20} />
    <div><p className="font-semibold">We couldn't load this</p><p className="muted text-sm">{message}</p>{retry && <button className="btn mt-3" onClick={retry}>Try again</button>}</div></Panel>
);

export const Empty = ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => (
  <Panel className="grid place-items-center gap-2 p-10 text-center"><p className="text-lg font-bold">{title}</p><p className="muted max-w-sm text-sm">{body}</p>{action && <div className="mt-2">{action}</div>}</Panel>
);

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLElement>('input,select,textarea')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) { const f = ref.current.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href]'); if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'rgba(10,12,30,.45)', backdropFilter: 'blur(6px)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="glass glass-strong rise max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button className="btn" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, error, children }: { label: string; error?: string; children: ReactNode }) => (
  <label className="mb-3 block text-sm font-semibold">{label}<div className="mt-1 font-normal">{children}</div>{error && <p className="mt-1 text-xs" style={{ color: 'var(--rose)' }}>{error}</p>}</label>
);

export const StatusChip = ({ s }: { s: string }) => {
  const c = ({ approved: 'var(--teal)', active: 'var(--teal)', completed: 'var(--teal)', needs_review: 'var(--rose)', pending: 'var(--amber)', upcoming: 'var(--accent)', planned: 'var(--accent)' } as Record<string, string>)[s] ?? 'var(--muted)';
  return <span className="chip" style={{ color: c }}>{s.replace('_', ' ')}</span>;
};

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtWhen = (d: string) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Reusable create/edit form modal: fields are declared, errors come back from the API. */
export interface FieldDef { name: string; label: string; type?: 'text' | 'date' | 'textarea' | 'select' | 'email' | 'url'; required?: boolean; options?: { value: string; label: string }[]; placeholder?: string }
import { useState } from 'react';
export function FormModal({ title, fields, initial = {}, submitLabel, onClose, onSubmit }: { title: string; fields: FieldDef[]; initial?: Record<string, string | null | undefined>; submitLabel: string; onClose: () => void; onSubmit: (v: Record<string, string>) => Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, String(initial[f.name] ?? '').slice(0, f.type === 'date' ? 10 : 4000)])));
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [missing, setMissing] = useState<string[]>([]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const m = fields.filter((f) => f.required && !v[f.name].trim()).map((f) => f.name); setMissing(m); if (m.length) return;
    setBusy(true); setErr(null);
    try { await onSubmit(v); onClose(); } catch (x) { setErr(x instanceof Error ? x.message : 'Could not save.'); setBusy(false); }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {fields.map((f) => (
          <Field key={f.name} label={f.label + (f.required ? ' *' : '')} error={missing.includes(f.name) ? `${f.label} is required.` : undefined}>
            {f.type === 'textarea' ? <textarea className="input" rows={3} value={v[f.name]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              : f.type === 'select' ? <select className="input" value={v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}><option value="">Select…</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              : <input className="input" type={f.type ?? 'text'} value={v[f.name]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
          </Field>
        ))}
        {err && <p role="alert" className="mb-3 text-sm" style={{ color: 'var(--rose)' }}>{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></div>
      </form>
    </Modal>
  );
}
export function Confirm({ title, body, confirmLabel, onClose, onConfirm }: { title: string; body: string; confirmLabel: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted mb-4 text-sm">{body}</p>{err && <p role="alert" className="mb-3 text-sm" style={{ color: 'var(--rose)' }}>{err}</p>}
      <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed.'); setBusy(false); } }}>{busy ? 'Working…' : confirmLabel}</button></div>
    </Modal>
  );
}

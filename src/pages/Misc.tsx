import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useAsync } from '../hooks';
import { api } from '../services/api';
import type { Activity as A } from '../types';
import { Empty, ErrorState, Field, Loading, PageHead, Panel, fmtWhen } from '../components/ui';
import { describe } from './Overview';

export function Activity() {
  const { data, error, loading, reload } = useAsync(() => api.get<A[]>('/activity'), []);
  return (<><PageHead title="Activity" sub="Important changes made in your workspace." />
    {loading && !data ? <Loading /> : error ? <ErrorState message={error} retry={reload} /> : data!.length === 0 ? <Empty title="No activity yet" body="Creating, editing and archiving records will show up here." /> :
      <Panel className="divide-y divide-[var(--line)]">{data!.map((a) => <div key={a.id} className="flex justify-between gap-3 px-5 py-3 text-sm"><span>{describe(a)}</span><span className="muted shrink-0">{fmtWhen(a.created_at)}</span></div>)}</Panel>}</>);
}

export function Settings() {
  const { me, refresh } = useAuth(); const [name, setName] = useState(me?.display_name ?? ''); const [inst, setInst] = useState(me?.institution ?? ''); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function save(e: React.FormEvent) { e.preventDefault(); setMsg(null); try { await api.patch('/auth/me', { display_name: name, institution: inst || null }); await refresh(); setMsg({ ok: true, t: 'Saved.' }); } catch (x) { setMsg({ ok: false, t: x instanceof Error ? x.message : 'Could not save.' }); } }
  return (<><PageHead title="Settings" sub="Your professor profile." />
    <form onSubmit={save} className="glass rise max-w-lg p-6"><Field label="Email"><input className="input" disabled value={me?.email ?? ''} /></Field><Field label="Name"><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Institution"><input className="input" value={inst} onChange={(e) => setInst(e.target.value)} /></Field>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className="mb-3 text-sm" style={{ color: msg.ok ? 'var(--teal)' : 'var(--rose)' }}>{msg.t}</p>}<button className="btn btn-primary">Save changes</button></form></>);
}

export const NotFound = () => <Empty title="Page not found" body="That address doesn't match anything in ProjectTrack." action={<Link className="btn btn-primary" to="/">Back to overview</Link>} />;

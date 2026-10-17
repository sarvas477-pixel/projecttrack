import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '../hooks';
import { api } from '../services/api';
import type { Hackathon, Project, TeamDetail } from '../types';
import { Confirm, ErrorState, FormModal, Loading, PageHead, Panel, StatusChip, fmtDate, fmtWhen } from '../components/ui';

type Dlg = 'edit' | 'member' | 'hackathon' | 'project' | 'archive' | null;
export default function TeamProfile() {
  const { id } = useParams(); const nav = useNavigate(); const { data: t, error, loading, reload } = useAsync(() => api.get<TeamDetail>(`/teams/${id}`), [id]); const [dlg, setDlg] = useState<Dlg>(null);
  const hacks = useAsync(() => (dlg === 'hackathon' ? api.get<Hackathon[]>('/hackathons') : Promise.resolve([] as Hackathon[])), [dlg]);
  const projs = useAsync(() => (dlg === 'project' ? api.get<Project[]>('/projects') : Promise.resolve([] as Project[])), [dlg]);
  if (loading && !t) return <Loading />; if (error || !t) return <ErrorState message={error ?? 'Team not found.'} retry={reload} />;
  const sec = 'glass rise p-5';
  return (
    <>
      <PageHead title={t.name} sub={`${t.team_code} · registered ${fmtDate(t.created_at)} · updated ${fmtWhen(t.updated_at)}`} crumbs={[{ to: '/teams', label: 'Teams' }, { label: t.team_code }]}
        actions={<><button className="btn" onClick={() => setDlg('edit')}><Pencil size={15} />Edit</button><button className="btn btn-danger" onClick={() => setDlg('archive')}><Archive size={15} />Archive</button></>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${sec} lg:col-span-2`}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">About</h2><StatusChip s={t.review_status} /></div>
          <dl className="grid gap-3 text-sm"><div><dt className="muted">Leader</dt><dd className="font-semibold">{t.leader_name ?? 'Not set'}</dd></div>
            <div><dt className="muted">Problem statement</dt><dd className="whitespace-pre-wrap">{t.problem_statement ?? 'Not set'}</dd></div>
            <div><dt className="muted">Description</dt><dd className="whitespace-pre-wrap">{t.description ?? 'Not set'}</dd></div>
            <div className="flex flex-wrap gap-x-8 gap-y-2"><div><dt className="muted">Repository</dt><dd>{t.repository_url ? <a className="underline" href={t.repository_url} target="_blank" rel="noreferrer">{t.repository_url}</a> : 'Not set'}</dd></div><div><dt className="muted">Demo</dt><dd>{t.demo_url ? <a className="underline" href={t.demo_url} target="_blank" rel="noreferrer">{t.demo_url}</a> : 'Not set'}</dd></div></div>
            <div><dt className="muted">Your notes</dt><dd className="whitespace-pre-wrap">{t.professor_notes ?? 'No notes yet.'}</dd></div></dl></section>
        <section className={sec} style={{ animationDelay: '60ms' }}><h2 className="mb-3 font-bold">Assigned to</h2>
          <p className="muted mb-1 text-xs font-semibold">Projects</p>{t.projects.length === 0 ? <p className="muted mb-2 text-sm">None.</p> : <ul className="mb-2 grid gap-1 text-sm">{t.projects.map((p) => <li key={p.id}><Link className="underline" to={`/projects/${p.id}`}>{p.name}</Link><span className="muted"> · {p.subject_name} / {p.batch_name}</span></li>)}</ul>}
          <button className="btn !py-1 mb-4" onClick={() => setDlg('project')}><Plus size={14} />Add to project</button>
          <p className="muted mb-1 text-xs font-semibold">Hackathons</p>{t.hackathons.length === 0 ? <p className="muted mb-2 text-sm">None.</p> : <ul className="mb-2 grid gap-1 text-sm">{t.hackathons.map((h) => <li key={h.id} className="flex items-center justify-between"><Link className="underline" to={`/hackathons/${h.id}`}>{h.name}</Link><button className="btn !p-1" aria-label={`Remove from ${h.name}`} onClick={async () => { await api.del(`/teams/${t.id}/hackathons/${h.id}`); reload(); }}><Trash2 size={13} /></button></li>)}</ul>}
          <button className="btn !py-1" onClick={() => setDlg('hackathon')}><Plus size={14} />Add to hackathon</button></section>
        <section className={`${sec} lg:col-span-2`} style={{ animationDelay: '100ms' }}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Members ({t.members.length})</h2><button className="btn !py-1" onClick={() => setDlg('member')}><Plus size={14} />Add member</button></div>
          {t.members.length === 0 ? <p className="muted text-sm">No members recorded. Imports only fill what the form collects.</p> : <ul className="grid gap-2">{t.members.map((m) => <li key={m.id} className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm"><span><b>{m.full_name}</b> <span className="muted">{[m.role, m.roll_number, m.email].filter(Boolean).join(' · ')}</span></span>
            <button className="btn !p-1" aria-label={`Remove ${m.full_name}`} onClick={async () => { await api.del(`/teams/${t.id}/members/${m.id}`); reload(); }}><Trash2 size={13} /></button></li>)}</ul>}</section>
        <section className={sec} style={{ animationDelay: '140ms' }}><h2 className="mb-3 font-bold">Milestone submissions</h2>
          {t.submissions.length === 0 ? <p className="muted text-sm">No submissions yet.</p> : <ul className="grid gap-2 text-sm">{t.submissions.map((s) => <li key={s.id} className="flex justify-between"><span>{s.milestone_name}</span><span className="muted">{s.submitted_at ? fmtDate(s.submitted_at) : s.status}</span></li>)}</ul>}</section>
      </div>
      {dlg === 'edit' && <FormModal title="Edit team" submitLabel="Save changes" initial={t as any} onClose={() => setDlg(null)} fields={[{ name: 'name', label: 'Team name', required: true }, { name: 'leader_name', label: 'Leader name' }, { name: 'problem_statement', label: 'Problem statement', type: 'textarea' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'repository_url', label: 'Repository URL', type: 'url' }, { name: 'demo_url', label: 'Demo URL', type: 'url' },
        { name: 'review_status', label: 'Review status', type: 'select', options: [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'needs_review', label: 'Needs review' }] }, { name: 'professor_notes', label: 'Your notes', type: 'textarea' }]}
        onSubmit={async (v) => { const changed = Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== String((t as any)[k] ?? ''))); if (Object.keys(changed).length) await api.patch(`/teams/${t.id}`, changed); reload(); }} />}
      {dlg === 'member' && <FormModal title="Add member" submitLabel="Add member" onClose={() => setDlg(null)} fields={[{ name: 'full_name', label: 'Full name', required: true }, { name: 'roll_number', label: 'Student ID' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'role', label: 'Role', type: 'select', options: [{ value: 'member', label: 'Member' }, { value: 'leader', label: 'Leader' }] }]}
        onSubmit={async (v) => { await api.post(`/teams/${t.id}/members`, { ...v, role: v.role || 'member' }); reload(); }} />}
      {dlg === 'hackathon' && <FormModal title="Add to hackathon" submitLabel="Add team" onClose={() => setDlg(null)} fields={[{ name: 'hackathon_id', label: 'Hackathon', required: true, type: 'select', options: (hacks.data ?? []).filter((h) => !t.hackathons.some((x) => x.id === h.id)).map((h) => ({ value: h.id, label: h.name })) }]}
        onSubmit={async (v) => { await api.post(`/teams/${t.id}/hackathons`, v); reload(); }} />}
      {dlg === 'project' && <FormModal title="Add to project" submitLabel="Add team" onClose={() => setDlg(null)} fields={[{ name: 'project_id', label: 'Project', required: true, type: 'select', options: (projs.data ?? []).filter((p) => !t.projects.some((x) => x.id === p.id)).map((p) => ({ value: p.id, label: `${p.subject_name} / ${p.batch_name} / ${p.name}` })) }]}
        onSubmit={async (v) => { await api.post(`/teams/${t.id}/projects`, v); reload(); }} />}
      {dlg === 'archive' && <Confirm title={`Archive ${t.name}?`} body="The team disappears from directories but its history is kept." confirmLabel="Archive team" onClose={() => setDlg(null)} onConfirm={async () => { await api.patch(`/teams/${t.id}`, { archived: true }); nav('/teams'); }} />}
    </>
  );
}

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAsync, useDebounced } from '../hooks';
import { api, qs } from '../services/api';
import type { Project, TeamRow } from '../types';
import { Empty, ErrorState, FormModal, Loading, PageHead, StatusChip } from '../components/ui';

const PAGE = 20;
export default function Teams() {
  const [sp, setSp] = useSearchParams(); const rs = sp.get('review_status') ?? ''; const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(0); const [add, setAdd] = useState(false);
  const { data, error, loading, reload } = useAsync(() => api.get<{ total: number; items: TeamRow[] }>(`/teams${qs({ q: dq, review_status: rs, limit: PAGE, offset: page * PAGE })}`), [dq, rs, page]);
  const projects = useAsync(() => (add ? api.get<Project[]>('/projects') : Promise.resolve([] as Project[])), [add]);
  return (
    <>
      <PageHead title="Teams" sub="Every team across your subjects and hackathons." actions={<>
        <input className="input w-56" placeholder="Search name, code, leader" aria-label="Search teams" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select className="input w-auto" aria-label="Filter by review status" value={rs} onChange={(e) => { const n = new URLSearchParams(); if (e.target.value) n.set('review_status', e.target.value); setSp(n); setPage(0); }}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="needs_review">Needs review</option></select>
        <button className="btn btn-primary" onClick={() => setAdd(true)}><Plus size={16} />New team</button></>} />
      {loading && !data ? <Loading rows={4} /> : error ? <ErrorState message={error} retry={reload} /> : data!.items.length === 0 ?
        <Empty title={dq || rs ? 'No teams match' : 'No teams yet'} body={dq || rs ? 'Try a different search or clear the filter.' : 'Register a team under a project, or import registrations from a form.'} /> :
        <>
          <div className="grid gap-3">{data!.items.map((t, i) => <Link key={t.id} to={`/teams/${t.id}`} className="glass lift rise grid items-center gap-2 p-4 sm:grid-cols-[1.4fr_1fr_auto]" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            <span><b className="block">{t.name}</b><span className="muted text-xs">{t.team_code} · {t.leader_name ?? 'No leader set'} · {t.member_count} members</span></span>
            <span className="muted text-sm">{t.project_names ?? 'Not in a project'}{t.hackathon_count > 0 && ` · ${t.hackathon_count} hackathon${t.hackathon_count > 1 ? 's' : ''}`}</span><StatusChip s={t.review_status} /></Link>)}</div>
          <div className="mt-5 flex items-center justify-between text-sm"><span className="muted">{data!.total} team{data!.total === 1 ? '' : 's'}</span>
            <span className="flex gap-2"><button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className="btn" disabled={(page + 1) * PAGE >= data!.total} onClick={() => setPage(page + 1)}>Next</button></span></div>
        </>}
      {add && <FormModal title="New team" submitLabel="Register team" onClose={() => setAdd(false)}
        fields={[{ name: 'name', label: 'Team name', required: true }, { name: 'leader_name', label: 'Leader name' }, { name: 'project_id', label: 'Project (optional)', type: 'select', options: (projects.data ?? []).map((p) => ({ value: p.id, label: `${p.subject_name} / ${p.batch_name} / ${p.name}` })) }]}
        onSubmit={async (v) => { await api.post('/teams', { ...v, project_id: v.project_id || undefined }); reload(); }} />}
    </>
  );
}

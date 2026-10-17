import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAsync } from '../hooks';
import { api } from '../services/api';
import { Empty, ErrorState, FormModal, Loading, PageHead, Panel, StatusChip, fmtDate } from '../components/ui';

interface PD { id: string; name: string; description: string | null; problem_statement: string | null; due_date: string | null; status: string; batch_id: string; batch_name: string; subject_id: string; subject_name: string;
  teams: { id: string; team_code: string; name: string; leader_name: string | null; review_status: string }[]; milestones: { id: string; name: string; due_date: string | null }[] }
export default function ProjectDetail() {
  const { id } = useParams(); const { data, error, loading, reload } = useAsync(() => api.get<PD>(`/projects/${id}`), [id]); const [add, setAdd] = useState(false);
  if (loading && !data) return <Loading />; if (error || !data) return <ErrorState message={error ?? 'Project not found.'} retry={reload} />;
  return (
    <>
      <PageHead title={data.name} crumbs={[{ to: '/academics', label: 'Academics' }, { to: `/academics?subject=${data.subject_id}&batch=${data.batch_id}`, label: `${data.subject_name} / ${data.batch_name}` }, { label: data.name }]}
        actions={<button className="btn btn-primary" onClick={() => setAdd(true)}><Plus size={16} />Register team</button>} />
      <Panel className="rise mb-5 grid gap-4 p-5 md:grid-cols-3">
        <div className="md:col-span-2"><h2 className="mb-1 font-bold">Problem statement</h2><p className="muted whitespace-pre-wrap text-sm">{data.problem_statement || 'Not set.'}</p>{data.description && <p className="mt-3 whitespace-pre-wrap text-sm">{data.description}</p>}</div>
        <div className="grid content-start gap-2 text-sm"><div><span className="muted">Status </span><StatusChip s={data.status} /></div><div><span className="muted">Due </span><b>{fmtDate(data.due_date)}</b></div><div><span className="muted">Teams </span><b>{data.teams.length}</b></div></div>
      </Panel>
      <h2 className="mb-3 text-lg font-bold">Teams</h2>
      {data.teams.length === 0 ? <Empty title="No teams yet" body="Register a team here, or import registrations from a form." action={<button className="btn btn-primary" onClick={() => setAdd(true)}>Register team</button>} /> :
        <div className="grid gap-3 md:grid-cols-2">{data.teams.map((t) => <Link key={t.id} to={`/teams/${t.id}`} className="glass lift rise flex items-center justify-between p-4"><span><b className="block">{t.name}</b><span className="muted text-xs">{t.team_code} · {t.leader_name ?? 'No leader set'}</span></span><StatusChip s={t.review_status} /></Link>)}</div>}
      {add && <FormModal title="Register team" submitLabel="Register team" onClose={() => setAdd(false)} fields={[{ name: 'name', label: 'Team name', required: true }, { name: 'leader_name', label: 'Leader name' }, { name: 'problem_statement', label: 'Problem statement', type: 'textarea' }]}
        onSubmit={async (v) => { await api.post('/teams', { ...v, project_id: id }); reload(); }} />}
    </>
  );
}

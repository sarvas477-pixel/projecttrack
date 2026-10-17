import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '../hooks';
import { api } from '../services/api';
import type { Hackathon, TeamRow } from '../types';
import { Confirm, Empty, ErrorState, FormModal, Loading, PageHead, Panel, StatusChip, fmtDate } from '../components/ui';
import { hackFields } from './Hackathons';

type HD = Hackathon & { teams: { id: string; team_code: string; name: string; leader_name: string | null }[] };
export default function HackathonDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { data: h, error, loading, reload } = useAsync(() => api.get<HD>(`/hackathons/${id}`), [id]); const [dlg, setDlg] = useState<'edit' | 'team' | 'archive' | null>(null);
  const all = useAsync(() => (dlg === 'team' ? api.get<{ items: TeamRow[] }>('/teams?limit=100') : Promise.resolve({ items: [] as TeamRow[] })), [dlg]);
  if (loading && !h) return <Loading />; if (error || !h) return <ErrorState message={error ?? 'Hackathon not found.'} retry={reload} />;
  return (
    <>
      <PageHead title={h.name} crumbs={[{ to: '/hackathons', label: 'Hackathons' }, { label: h.name }]} actions={<><button className="btn" onClick={() => setDlg('edit')}><Pencil size={15} />Edit</button><button className="btn btn-danger" onClick={() => setDlg('archive')}><Archive size={15} />Archive</button><button className="btn btn-primary" onClick={() => setDlg('team')}><Plus size={16} />Add team</button></>} />
      <Panel className="rise mb-5 grid gap-3 p-5 text-sm md:grid-cols-3"><div><span className="muted">Status </span><StatusChip s={h.status} /></div><div><span className="muted">Dates </span><b>{fmtDate(h.start_date)} to {fmtDate(h.end_date)}</b></div><div><span className="muted">Organizer </span><b>{h.organizer ?? 'Not set'}</b></div>
        {h.registration_url && <div className="md:col-span-3"><a className="underline" href={h.registration_url} target="_blank" rel="noreferrer">Registration link</a></div>}{h.description && <p className="whitespace-pre-wrap md:col-span-3">{h.description}</p>}</Panel>
      <h2 className="mb-3 text-lg font-bold">Participating teams</h2>
      {h.teams.length === 0 ? <Empty title="No teams yet" body="Add teams that are taking part in this hackathon." action={<button className="btn btn-primary" onClick={() => setDlg('team')}>Add team</button>} /> :
        <div className="grid gap-3 md:grid-cols-2">{h.teams.map((t) => <div key={t.id} className="glass flex items-center justify-between p-4"><Link to={`/teams/${t.id}`}><b className="block">{t.name}</b><span className="muted text-xs">{t.team_code} · {t.leader_name ?? 'No leader set'}</span></Link>
          <button className="btn !p-1.5" aria-label={`Remove ${t.name}`} onClick={async () => { await api.del(`/teams/${t.id}/hackathons/${h.id}`); reload(); }}><Trash2 size={14} /></button></div>)}</div>}
      {dlg === 'edit' && <FormModal title="Edit hackathon" fields={hackFields} initial={h as any} submitLabel="Save changes" onClose={() => setDlg(null)} onSubmit={async (v) => { await api.patch(`/hackathons/${h.id}`, { ...v, status: v.status || undefined }); reload(); }} />}
      {dlg === 'team' && <FormModal title="Add team" submitLabel="Add team" onClose={() => setDlg(null)} fields={[{ name: 'team_id', label: 'Team', required: true, type: 'select', options: (all.data?.items ?? []).filter((t) => !h.teams.some((x) => x.id === t.id)).map((t) => ({ value: t.id, label: `${t.name} (${t.team_code})` })) }]}
        onSubmit={async (v) => { await api.post(`/teams/${v.team_id}/hackathons`, { hackathon_id: h.id }); reload(); }} />}
      {dlg === 'archive' && <Confirm title={`Archive ${h.name}?`} body="It is hidden from lists. Teams keep their own records." confirmLabel="Archive" onClose={() => setDlg(null)} onConfirm={async () => { await api.patch(`/hackathons/${h.id}`, { archived: true }); nav('/hackathons'); }} />}
    </>
  );
}

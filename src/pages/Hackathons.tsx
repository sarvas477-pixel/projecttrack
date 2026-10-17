import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAsync, useDebounced } from '../hooks';
import { api, qs } from '../services/api';
import type { Hackathon } from '../types';
import { Empty, ErrorState, FormModal, Loading, PageHead, StatusChip, fmtDate, type FieldDef } from '../components/ui';

export const hackFields: FieldDef[] = [{ name: 'name', label: 'Hackathon name', required: true }, { name: 'organizer', label: 'Organizer' }, { name: 'start_date', label: 'Start date', type: 'date' }, { name: 'end_date', label: 'End date', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: ['upcoming', 'active', 'completed'].map((s) => ({ value: s, label: s })) }, { name: 'registration_url', label: 'Registration link', type: 'url' }, { name: 'description', label: 'Description', type: 'textarea' }];

export default function Hackathons() {
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [st, setSt] = useState(''); const [add, setAdd] = useState(false);
  const { data, error, loading, reload } = useAsync(() => api.get<Hackathon[]>(`/hackathons${qs({ q: dq, status: st })}`), [dq, st]);
  return (
    <>
      <PageHead title="Hackathons" sub="Events your teams take part in. A team can join several without being copied." actions={<>
        <input className="input w-56" placeholder="Search hackathons" aria-label="Search hackathons" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" aria-label="Filter by status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select>
        <button className="btn btn-primary" onClick={() => setAdd(true)}><Plus size={16} />New hackathon</button></>} />
      {loading && !data ? <Loading rows={3} /> : error ? <ErrorState message={error} retry={reload} /> : data!.length === 0 ? <Empty title="No hackathons" body={dq || st ? 'Nothing matches your filters.' : 'Add a hackathon, then attach teams to it.'} action={!dq && !st ? <button className="btn btn-primary" onClick={() => setAdd(true)}>New hackathon</button> : undefined} /> :
        <div className="grid gap-4 md:grid-cols-2">{data!.map((h, i) => <Link key={h.id} to={`/hackathons/${h.id}`} className="glass lift rise p-5" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
          <div className="mb-2 flex items-start justify-between gap-2"><b className="text-lg">{h.name}</b><StatusChip s={h.status} /></div>
          <p className="muted text-sm">{h.organizer ?? 'Organizer not set'}</p><p className="mt-3 text-sm">{fmtDate(h.start_date)} to {fmtDate(h.end_date)} · <b>{h.team_count}</b> team{h.team_count === 1 ? '' : 's'}</p></Link>)}</div>}
      {add && <FormModal title="New hackathon" submitLabel="Create hackathon" fields={hackFields} onClose={() => setAdd(false)} onSubmit={async (v) => { await api.post('/hackathons', { ...v, status: v.status || undefined }); reload(); }} />}
    </>
  );
}

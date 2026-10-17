import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAsync } from '../hooks';
import { api } from '../services/api';
import type { FormSource, Project, Hackathon } from '../types';
import { Empty, ErrorState, FormModal, Loading, PageHead, Panel, fmtWhen } from '../components/ui';

export default function Forms() {
  const { data, error, loading, reload } = useAsync(() => api.get<FormSource[]>('/forms'), []); const [add, setAdd] = useState(false);
  const projs = useAsync(() => (add ? api.get<Project[]>('/projects') : Promise.resolve([] as Project[])), [add]);
  const hacks = useAsync(() => (add ? api.get<Hackathon[]>('/hackathons') : Promise.resolve([] as Hackathon[])), [add]);
  return (
    <>
      <PageHead title="Forms and sync" sub="Registration and milestone forms linked to a project or hackathon." actions={<button className="btn btn-primary" onClick={() => setAdd(true)}><Plus size={16} />Connect a form</button>} />
      <Panel className="mb-5 p-4 text-sm" role="note"><b>Live Google Sheets import is not wired up yet.</b> <span className="muted">You can register a form here and see its sync history, but nothing is fetched from Google until the ingest connector is built. No sync results on this page are simulated.</span></Panel>
      {loading && !data ? <Loading rows={2} /> : error ? <ErrorState message={error} retry={reload} /> : data!.length === 0 ? <Empty title="No forms connected" body="Connect a registration form to a project, or a milestone form to track updates." /> :
        <div className="grid gap-4 md:grid-cols-2">{data!.map((f) => <Panel key={f.id} className="rise p-5"><div className="flex justify-between gap-2"><b>{f.label}</b><span className="chip">{f.purpose}</span></div>
          <p className="muted mt-1 text-sm">{f.project_name ? `Project: ${f.project_name}` : `Hackathon: ${f.hackathon_name}`}</p>
          <p className="mt-3 text-sm">{f.last_run ? <>Last sync {fmtWhen(f.last_synced_at ?? '')}: <b>{f.last_run.created_count}</b> new, <b>{f.last_run.updated_count}</b> updated, <b>{f.last_run.unchanged_count}</b> unchanged, <b>{f.last_run.error_count}</b> rejected</> : <span className="muted">Never synced.</span>}</p></Panel>)}</div>}
      {add && <FormModal title="Connect a form" submitLabel="Connect form" onClose={() => setAdd(false)}
        fields={[{ name: 'label', label: 'Name', required: true }, { name: 'purpose', label: 'Purpose', required: true, type: 'select', options: [{ value: 'registration', label: 'Team registration' }, { value: 'milestone', label: 'Milestone update' }, { value: 'final', label: 'Final submission' }, { value: 'custom', label: 'Other' }] }, { name: 'form_url', label: 'Google Form link', type: 'url' },
          { name: 'target', label: 'Attach to', required: true, type: 'select', options: [...(projs.data ?? []).map((p) => ({ value: `p:${p.id}`, label: `Project: ${p.name}` })), ...(hacks.data ?? []).map((h) => ({ value: `h:${h.id}`, label: `Hackathon: ${h.name}` }))] }]}
        onSubmit={async (v) => { const [k, tid] = v.target.split(':'); await api.post('/forms', { label: v.label, purpose: v.purpose, form_url: v.form_url, ...(k === 'p' ? { project_id: tid } : { hackathon_id: tid }) }); reload(); }} />}
    </>
  );
}

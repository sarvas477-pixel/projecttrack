import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Pencil, Plus } from 'lucide-react';
import { useAsync, useDebounced } from '../hooks';
import { api, qs } from '../services/api';
import type { Batch, Project, Subject } from '../types';
import { Confirm, Empty, ErrorState, FormModal, Loading, PageHead, Panel, StatusChip, type FieldDef } from '../components/ui';

type Dlg = { kind: 'subject' | 'batch' | 'project'; edit?: any } | { kind: 'archive'; path: string; name: string } | null;
const F: Record<string, FieldDef[]> = {
  subject: [{ name: 'name', label: 'Subject name', required: true }, { name: 'course_code', label: 'Course code' }, { name: 'description', label: 'Description', type: 'textarea' }],
  batch: [{ name: 'name', label: 'Batch name', required: true }, { name: 'academic_year', label: 'Academic year', placeholder: '2026-27' }],
  project: [{ name: 'name', label: 'Project name', required: true }, { name: 'problem_statement', label: 'Problem statement', type: 'textarea' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'due_date', label: 'Due date', type: 'date' }],
};

export default function Academics() {
  const [sp, setSp] = useSearchParams(); const subject = sp.get('subject'), batch = sp.get('batch');
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [dlg, setDlg] = useState<Dlg>(null);
  const subs = useAsync(() => api.get<Subject[]>(`/subjects${qs({ q: dq })}`), [dq]);
  const bats = useAsync(() => (subject ? api.get<Batch[]>(`/batches${qs({ subject_id: subject })}`) : Promise.resolve([] as Batch[])), [subject]);
  const projs = useAsync(() => (batch ? api.get<Project[]>(`/projects${qs({ batch_id: batch })}`) : Promise.resolve([] as Project[])), [batch]);
  const pick = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k === 'subject') n.delete('batch'); setSp(n); };
  const reloadAll = () => { subs.reload(); bats.reload(); projs.reload(); };
  const col = 'glass rise min-w-0 p-4';
  const row = (active: boolean) => `lift flex w-full items-start justify-between gap-2 rounded-2xl border p-3 text-left ${active ? 'border-[var(--accent)] bg-[var(--glass-strong)]' : 'border-[var(--line)]'}`;
  return (
    <>
      <PageHead title="Academics" sub="Subject, then batch, then project. Pick one in each column to go deeper." actions={<><input className="input w-56" placeholder="Search subjects" aria-label="Search subjects" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn btn-primary" onClick={() => setDlg({ kind: 'subject' })}><Plus size={16} />New subject</button></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className={col} aria-label="Subjects"><h2 className="mb-3 font-bold">Subjects</h2>
          {subs.loading && !subs.data ? <Loading rows={2} /> : subs.error ? <ErrorState message={subs.error} retry={subs.reload} /> : subs.data?.length === 0 ? <Empty title="No subjects" body={dq ? 'No subject matches your search.' : 'Create a subject to begin.'} /> :
            <ul className="grid gap-2">{subs.data!.map((s) => <li key={s.id} className="group relative"><button className={row(subject === s.id)} onClick={() => pick('subject', s.id)}><span><span className="block font-semibold">{s.name}</span><span className="muted text-xs">{s.course_code ?? 'No code'} · {s.batch_count} batches · {s.project_count} projects</span></span></button>
              <span className="absolute right-2 top-2 hidden gap-1 group-hover:flex group-focus-within:flex"><button className="btn !p-1.5" aria-label={`Edit ${s.name}`} onClick={() => setDlg({ kind: 'subject', edit: s })}><Pencil size={13} /></button><button className="btn !p-1.5" aria-label={`Archive ${s.name}`} onClick={() => setDlg({ kind: 'archive', path: `/subjects/${s.id}`, name: s.name })}><Archive size={13} /></button></span></li>)}</ul>}
        </section>
        <section className={col} style={{ animationDelay: '60ms' }} aria-label="Batches"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Batches</h2>{subject && <button className="btn !py-1" onClick={() => setDlg({ kind: 'batch' })}><Plus size={14} />Add</button>}</div>
          {!subject ? <p className="muted text-sm">Choose a subject.</p> : bats.loading && !bats.data ? <Loading rows={2} /> : bats.error ? <ErrorState message={bats.error} retry={bats.reload} /> : bats.data?.length === 0 ? <Empty title="No batches" body="Add the first batch for this subject." /> :
            <ul className="grid gap-2">{bats.data!.map((b) => <li key={b.id} className="group relative"><button className={row(batch === b.id)} onClick={() => pick('batch', b.id)}><span><span className="block font-semibold">{b.name}</span><span className="muted text-xs">{b.academic_year ?? 'No year'} · {b.project_count} projects</span></span></button>
              <span className="absolute right-2 top-2 hidden gap-1 group-hover:flex group-focus-within:flex"><button className="btn !p-1.5" aria-label={`Edit ${b.name}`} onClick={() => setDlg({ kind: 'batch', edit: b })}><Pencil size={13} /></button><button className="btn !p-1.5" aria-label={`Archive ${b.name}`} onClick={() => setDlg({ kind: 'archive', path: `/batches/${b.id}`, name: b.name })}><Archive size={13} /></button></span></li>)}</ul>}
        </section>
        <section className={col} style={{ animationDelay: '120ms' }} aria-label="Projects"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Projects</h2>{batch && <button className="btn !py-1" onClick={() => setDlg({ kind: 'project' })}><Plus size={14} />Add</button>}</div>
          {!batch ? <p className="muted text-sm">Choose a batch.</p> : projs.loading && !projs.data ? <Loading rows={2} /> : projs.error ? <ErrorState message={projs.error} retry={projs.reload} /> : projs.data?.length === 0 ? <Empty title="No projects" body="Add the first project for this batch." /> :
            <ul className="grid gap-2">{projs.data!.map((p) => <li key={p.id}><Link className={row(false)} to={`/projects/${p.id}`}><span><span className="block font-semibold">{p.name}</span><span className="muted text-xs">{p.team_count} teams · due {p.due_date ? new Date(p.due_date).toLocaleDateString() : 'not set'}</span></span><StatusChip s={p.status} /></Link></li>)}</ul>}
        </section>
      </div>
      {dlg && dlg.kind !== 'archive' && <FormModal title={`${dlg.edit ? 'Edit' : 'New'} ${dlg.kind}`} fields={F[dlg.kind]} initial={dlg.edit} submitLabel={dlg.edit ? 'Save changes' : `Create ${dlg.kind}`} onClose={() => setDlg(null)}
        onSubmit={async (v) => { const parent = dlg.kind === 'batch' ? { subject_id: subject } : dlg.kind === 'project' ? { batch_id: batch } : {}; const path = `/${dlg.kind}s`;
          if (dlg.edit) await api.patch(`${path}/${dlg.edit.id}`, v); else await api.post(path, { ...v, ...parent }); reloadAll(); }} />}
      {dlg?.kind === 'archive' && <Confirm title={`Archive ${dlg.name}?`} body="It will be hidden from lists. Teams and history are kept, and nothing is deleted." confirmLabel="Archive" onClose={() => setDlg(null)} onConfirm={async () => { await api.patch(dlg.path, { archived: true }); if (dlg.path.includes('/subjects/')) pick('subject', null); reloadAll(); }} />}
    </>
  );
}

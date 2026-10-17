import { Link } from 'react-router-dom';
import { useAsync } from '../hooks';
import { api } from '../services/api';
import type { Dashboard } from '../types';
import { Empty, ErrorState, Loading, PageHead, Panel, fmtWhen } from '../components/ui';
import SpatialMap from '../features/overview/SpatialMap';
import { useAuth } from '../auth';

const label: Record<string, string> = { subjects: 'Subjects', batches: 'Batches', projects: 'Projects', teams: 'Teams', hackathons: 'Hackathons' };
export const describe = (a: { entity_type: string; action: string; after_data: Record<string, unknown> | null }) => {
  const n = (a.after_data?.name as string) || (a.after_data?.team_code as string) || (a.after_data?.label as string); return `${a.entity_type.replace('_', ' ')} ${a.action.replace('_', ' ')}${n ? `: ${n}` : ''}`;
};

export default function Overview() {
  const { me } = useAuth(); const { data, error, loading, reload } = useAsync(() => api.get<Dashboard>('/dashboard'), []);
  if (loading && !data) return <><PageHead title="Overview" /><Loading rows={4} /></>;
  if (error || !data) return <><PageHead title="Overview" /><ErrorState message={error ?? 'No data returned.'} retry={reload} /></>;
  const c = data.counts; const empty = c.subjects === 0 && c.hackathons === 0;
  return (
    <>
      <PageHead title={`Welcome${me?.display_name ? `, ${me.display_name.split(' ')[0]}` : ''}`} sub="Everything you manage, laid out as a map. Click a node to open it." actions={<><Link className="btn" to="/hackathons">New hackathon</Link><Link className="btn btn-primary" to="/academics">Open academics</Link></>} />
      <section aria-label="Totals" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(label) as (keyof typeof label)[]).map((k, i) => (
          <Link key={k} to={k === 'hackathons' ? '/hackathons' : k === 'teams' ? '/teams' : '/academics'} className="glass lift rise p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <p className="text-3xl font-extrabold tabular-nums">{(c as any)[k]}</p><p className="muted text-sm font-semibold">{label[k]}</p></Link>))}
      </section>
      {c.needs_review > 0 && <Link to="/teams?review_status=needs_review" className="glass mb-5 block p-4 text-sm font-semibold" style={{ color: 'var(--rose)' }}>{c.needs_review} team{c.needs_review > 1 ? 's' : ''} need your review</Link>}
      {empty ? <Empty title="Nothing here yet" body="Create your first subject to start building the map. Batches, projects and teams branch out from it." action={<Link className="btn btn-primary" to="/academics">Create a subject</Link>} />
        : <Panel className="mb-5 p-1 rise"><SpatialMap tree={data.tree} /></Panel>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5"><h2 className="mb-3 font-bold">Hackathons</h2>
          {data.hackathons.length === 0 ? <p className="muted text-sm">No hackathons yet.</p> : <ul className="grid gap-2">{data.hackathons.map((h) => <li key={h.id}><Link className="flex justify-between rounded-xl px-3 py-2 hover:bg-[var(--glass-strong)]" to={`/hackathons/${h.id}`}><span className="font-semibold">{h.name}</span><span className="muted text-sm">{h.team_count} teams · {h.status}</span></Link></li>)}</ul>}</Panel>
        <Panel className="p-5"><div className="mb-3 flex justify-between"><h2 className="font-bold">Recent activity</h2><Link className="muted text-sm underline" to="/activity">See all</Link></div>
          {data.activity.length === 0 ? <p className="muted text-sm">Changes you make will appear here.</p> : <ul className="grid gap-2 text-sm">{data.activity.map((a) => <li key={a.id} className="flex justify-between gap-3"><span>{describe(a)}</span><span className="muted shrink-0">{fmtWhen(a.created_at)}</span></li>)}</ul>}</Panel>
      </div>
    </>
  );
}

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Maximize2 } from 'lucide-react';
import type { Dashboard } from '../../types';

interface N { key: string; label: string; x: number; y: number; r: number; level: 0 | 1 | 2 | 3; to: string; sub?: string }
interface L { a: string; b: string }
const R = [0, 150, 270, 390];

/** Radial layout built only from real rows: each subject owns an angular sector sized by its leaf count. */
function layout(tree: Dashboard['tree']) {
  const subjects = new Map<string, { name: string; batches: Map<string, { name: string; projects: { id: string; name: string; teams: number }[] }> }>();
  for (const r of tree) {
    const s = subjects.get(r.sid) ?? { name: r.sname, batches: new Map() }; subjects.set(r.sid, s);
    if (r.bid) { const b = s.batches.get(r.bid) ?? { name: r.bname ?? '', projects: [] }; s.batches.set(r.bid, b); if (r.pid) b.projects.push({ id: r.pid, name: r.pname ?? '', teams: r.team_count }); }
  }
  const leafCount = (s: { batches: Map<string, { projects: unknown[] }> }) => Math.max(1, [...s.batches.values()].reduce((n, b) => n + Math.max(1, b.projects.length), 0));
  const total = [...subjects.values()].reduce((n, s) => n + leafCount(s), 0) || 1;
  const nodes: N[] = [{ key: 'root', label: 'Workspace', x: 0, y: 0, r: 34, level: 0, to: '/academics' }]; const links: L[] = [];
  let cursor = -Math.PI / 2; const at = (rad: number, a: number) => ({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  for (const [sid, s] of subjects) {
    const span = (leafCount(s) / total) * Math.PI * 2; const start = cursor; cursor += span;
    const sp = at(R[1], start + span / 2); nodes.push({ key: sid, label: s.name, ...sp, r: 26, level: 1, to: `/academics?subject=${sid}` }); links.push({ a: 'root', b: sid });
    let bc = start; const per = span / leafCount(s);
    for (const [bid, b] of s.batches) {
      const n = Math.max(1, b.projects.length); const bs = bc; bc += per * n; const bp = at(R[2], bs + (per * n) / 2);
      nodes.push({ key: bid, label: b.name, ...bp, r: 19, level: 2, to: `/academics?subject=${sid}&batch=${bid}` }); links.push({ a: sid, b: bid });
      b.projects.forEach((p, i) => { const pp = at(R[3], bs + per * (i + 0.5)); nodes.push({ key: p.id, label: p.name, ...pp, r: 11 + Math.min(p.teams, 8), level: 3, to: `/projects/${p.id}`, sub: `${p.teams} team${p.teams === 1 ? '' : 's'}` }); links.push({ a: bid, b: p.id }); });
    }
  }
  return { nodes, links };
}

export default function SpatialMap({ tree }: { tree: Dashboard['tree'] }) {
  const nav = useNavigate(); const { nodes, links } = useMemo(() => layout(tree), [tree]);
  const [v, setV] = useState({ x: 0, y: 0, k: 0.8 }); const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null); const [hover, setHover] = useState<string | null>(null);
  const byKey = new Map(nodes.map((n) => [n.key, n])); const fill = ['var(--ink)', 'var(--accent)', 'var(--teal)', 'var(--amber)'];
  const zoom = (d: number) => setV((s) => ({ ...s, k: Math.min(2.2, Math.max(0.35, s.k * d)) }));
  return (
    <div className="relative h-[460px] overflow-hidden rounded-[22px]" style={{ touchAction: 'none' }}>
      <svg role="group" aria-label="Map of your subjects, batches and projects. Drag to pan." className="h-full w-full cursor-grab active:cursor-grabbing" viewBox="-500 -250 1000 500"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; d.x = e.clientX; d.y = e.clientY; setV((s) => ({ ...s, x: s.x + dx, y: s.y + dy })); }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
        <g transform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
          {[1, 2, 3].map((i) => <circle key={i} r={R[i]} fill="none" stroke="var(--line)" strokeDasharray="2 7" />)}
          {links.map((l) => { const a = byKey.get(l.a)!, b = byKey.get(l.b)!; return <line key={l.a + l.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line)" strokeWidth={1.5} />; })}
          {nodes.map((n) => (
            <g key={n.key} transform={`translate(${n.x} ${n.y})`} tabIndex={0} role="link" aria-label={`${n.label}${n.sub ? `, ${n.sub}` : ''}`} style={{ cursor: 'pointer', outline: 'none' }}
              onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.key)} onBlur={() => setHover(null)}
              onClick={() => { if (!drag.current?.moved) nav(n.to); }} onKeyDown={(e) => e.key === 'Enter' && nav(n.to)}>
              <circle r={n.r + (hover === n.key ? 5 : 0)} fill={fill[n.level]} opacity={n.level === 0 ? 0.92 : 0.2} style={{ transition: 'r .2s' }} />
              <circle r={n.r * 0.55} fill={fill[n.level]} />
              {(n.level < 3 || hover === n.key) && <text y={n.r + 16} textAnchor="middle" fontSize={n.level === 1 ? 14 : 12} fontWeight={700} fill="var(--ink)" style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 4 }}>{n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label}</text>}
              {hover === n.key && n.sub && <text y={n.r + 30} textAnchor="middle" fontSize={11} fill="var(--muted)" style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 4 }}>{n.sub}</text>}
            </g>
          ))}
        </g>
      </svg>
      <div className="glass absolute bottom-3 right-3 flex gap-1 p-1">
        <button className="btn" aria-label="Zoom in" onClick={() => zoom(1.2)}><Plus size={14} /></button>
        <button className="btn" aria-label="Zoom out" onClick={() => zoom(1 / 1.2)}><Minus size={14} /></button>
        <button className="btn" aria-label="Reset view" onClick={() => setV({ x: 0, y: 0, k: 0.8 })}><Maximize2 size={14} /></button>
      </div>
      <div className="glass absolute bottom-3 left-3 flex gap-3 px-3 py-2 text-xs font-semibold">
        {[['Subject', 1], ['Batch', 2], ['Project', 3]].map(([l, i]) => <span key={l as string} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: fill[i as number] }} />{l}</span>)}
      </div>
    </div>
  );
}

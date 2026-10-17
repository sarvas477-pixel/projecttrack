import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Atom, BookOpen, Boxes, FileSpreadsheet, LogOut, Moon, Rocket, Settings, Sun, Users } from 'lucide-react';
import { useAuth } from '../auth';

const items = [
  { to: '/', label: 'Overview', icon: Atom, end: true }, { to: '/academics', label: 'Academics', icon: BookOpen },
  { to: '/hackathons', label: 'Hackathons', icon: Rocket }, { to: '/teams', label: 'Teams', icon: Users },
  { to: '/forms', label: 'Forms & sync', icon: FileSpreadsheet }, { to: '/activity', label: 'Activity', icon: Boxes },
];
export default function Shell() {
  const { me, logout } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('pt-theme') === 'dark');
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('pt-theme', dark ? 'dark' : 'light'); }, [dark]);
  const initials = (me?.display_name ?? me?.email ?? '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <>
      <div className="space-bg" aria-hidden><i /><i /><i /></div>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn">Skip to content</a>
      <nav aria-label="Main" className="glass fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 p-1.5 md:bottom-auto md:left-4 md:top-1/2 md:-translate-y-1/2 md:translate-x-0 md:flex-col md:p-2">
        {items.map(({ to, label, icon: I, end }) => (
          <NavLink key={to} to={to} end={end} aria-label={label} className={({ isActive }) => `dock-link ${isActive ? 'active' : ''}`}><I size={20} /><span className="tip">{label}</span></NavLink>
        ))}
        <div className="mx-2 my-1 h-px md:mx-1" style={{ background: 'var(--line)' }} />
        <NavLink to="/settings" aria-label="Settings" className={({ isActive }) => `dock-link ${isActive ? 'active' : ''}`}><Settings size={20} /><span className="tip">Settings</span></NavLink>
      </nav>
      <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
        <button className="btn" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        <div className="glass flex items-center gap-2 py-1 pl-1 pr-3"><span className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>{initials}</span>
          <span className="hidden text-sm font-semibold sm:inline">{me?.display_name ?? me?.email}</span>
          <button className="ml-1" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div>
      </div>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-20 md:pl-28 md:pr-6 md:pb-10"><Outlet /></main>
    </>
  );
}

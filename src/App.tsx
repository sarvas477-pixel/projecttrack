import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Shell from './layouts/Shell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Academics from './pages/Academics';
import ProjectDetail from './pages/ProjectDetail';
import Teams from './pages/Teams';
import TeamProfile from './pages/TeamProfile';
import Hackathons from './pages/Hackathons';
import HackathonDetail from './pages/HackathonDetail';
import Forms from './pages/Forms';
import { Activity, NotFound, Settings } from './pages/Misc';

export default function App() {
  const { me, ready } = useAuth();
  if (!ready) return <div className="grid min-h-full place-items-center" role="status">Loading…</div>;
  if (!me) return <Routes><Route path="*" element={<Login />} /></Routes>;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Overview />} />
        <Route path="academics" element={<Academics />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamProfile />} />
        <Route path="hackathons" element={<Hackathons />} />
        <Route path="hackathons/:id" element={<HackathonDetail />} />
        <Route path="forms" element={<Forms />} />
        <Route path="activity" element={<Activity />} />
        <Route path="settings" element={<Settings />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

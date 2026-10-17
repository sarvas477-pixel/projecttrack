import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './services/api';
import type { Me } from './types';

interface Ctx { me: Me | null; ready: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null); const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try { setMe(await api.get<Me>('/auth/me')); } catch (e) { setMe(null); if (!(e instanceof ApiError) || e.status !== 401) console.warn(e); } finally { setReady(true); }
  }, []);
  useEffect(() => { refresh(); const f = () => setMe(null); window.addEventListener('pt:unauthorized', f); return () => window.removeEventListener('pt:unauthorized', f); }, [refresh]);
  const logout = useCallback(async () => { await api.post('/auth/logout').catch(() => {}); setMe(null); }, []);
  return <AuthCtx.Provider value={{ me, ready, refresh, logout }}>{children}</AuthCtx.Provider>;
}

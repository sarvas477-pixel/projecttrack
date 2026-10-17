import { useCallback, useEffect, useRef, useState } from 'react';
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const seq = useRef(0); const fnRef = useRef(fn); fnRef.current = fn;
  const load = useCallback(() => {
    const n = ++seq.current; setLoading(true); setError(null);
    fnRef.current().then((d) => { if (n === seq.current) setData(d); }).catch((e) => { if (n === seq.current) setError(e instanceof Error ? e.message : 'Something went wrong.'); }).finally(() => { if (n === seq.current) setLoading(false); });
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, deps);
  return { data, error, loading, reload: load };
}
export function useDebounced<T>(v: T, ms = 250) { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; }

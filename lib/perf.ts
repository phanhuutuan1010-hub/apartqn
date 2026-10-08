import 'server-only';
import { cache } from 'react';
import { after } from 'next/server';

/**
 * Request timing for Supabase calls (auth + queries), on only with PERF_LOG=1.
 * - every Supabase HTTP call: "[perf] <route> GET rest:admin_listings 12ms"
 * - React Server Component requests: one summary line at the end (auth ms, each query, count, total)
 * - the proxy adds a Server-Timing header for its own work (see proxy.ts)
 */
export const PERF = process.env.PERF_LOG === '1';

type Entry = { name: string; ms: number };
type Store = { t0: number; route: string; entries: Entry[]; scheduled: boolean };

// per request inside React renders; outside (actions, route handlers) cache() is not memoised → per call
const store = cache((): Store => ({ t0: performance.now(), route: '', entries: [], scheduled: false }));

const label = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  const path = url.pathname.replace(/^\/rest\/v1\/(rpc\/)?/, (_, rpc) => (rpc ? 'rpc:' : 'rest:')).replace(/^\/auth\/v1\//, 'auth:').replace(/^\/storage\/v1\//, 'storage:');
  const count = url.searchParams.get('select')?.includes('count') || /count=/.test(String((init?.headers as Record<string, string> | undefined)?.Prefer ?? '')) ? ' (count)' : '';
  return `${method} ${path}${count}`;
};

function record(name: string, ms: number, route?: string) {
  let s: Store | undefined;
  try {
    s = store();
  } catch {
    s = undefined;
  }
  if (route && s && !s.route) s.route = route;
  console.log(`[perf] ${route ?? s?.route ?? ''} ${name} ${ms.toFixed(0)}ms`);
  if (!s) return;
  s.entries.push({ name, ms });
  if (!s.scheduled) {
    s.scheduled = true;
    try {
      after(() => {
        const q = s.entries.filter((e) => !e.name.startsWith('auth') && !e.name.includes('auth:'));
        const auth = s.entries.filter((e) => e.name.startsWith('auth') || e.name.includes('auth:'));
        const slow = [...q].sort((a, b) => b.ms - a.ms)[0];
        console.log(
          `[perf] SUMMARY ${s.route || '?'} total=${(performance.now() - s.t0).toFixed(0)}ms auth=${auth.reduce((a, e) => a + e.ms, 0).toFixed(0)}ms` +
            ` (${auth.length} calls) queries=${q.length} sum=${q.reduce((a, e) => a + e.ms, 0).toFixed(0)}ms slowest=${slow ? `${slow.name} ${slow.ms.toFixed(0)}ms` : '-'}`,
        );
      });
    } catch {
      // after() unavailable here (e.g. outside a request) — per-call lines are enough
    }
  }
}

/** Name the current request in the summary (call once, e.g. from requireStaff). */
export function perfRoute(route: string) {
  if (!PERF) return;
  try {
    const s = store();
    if (!s.route) s.route = route;
  } catch {}
}

/** fetch for Supabase clients: identical behaviour, timed when PERF_LOG=1. */
export function perfFetch(route?: string): typeof fetch | undefined {
  if (!PERF) return undefined;
  return async (input, init) => {
    const t = performance.now();
    try {
      return await fetch(input, init);
    } finally {
      record(label(input, init), performance.now() - t, route);
    }
  };
}

/** Time a non-fetch step (e.g. local JWT verification). */
export async function perfTime<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!PERF) return fn();
  const t = performance.now();
  try {
    return await fn();
  } finally {
    record(name, performance.now() - t);
  }
}

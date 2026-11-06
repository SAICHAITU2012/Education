import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  query: URLSearchParams;
}

export function parseRoute(hash: string): Route {
  // The landing page is the public front door, including for fresh installs.
  // Returning users keep their current route because the hash remains intact.
  const raw = hash.replace(/^#/, '') || '/landing';
  const queryIndex = raw.indexOf('?');
  const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const qs = queryIndex === -1 ? '' : raw.slice(queryIndex + 1);
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path: string): void {
  const clean = path.startsWith('/') ? path : `/${path}`;
  window.location.hash = `#${clean}`;
}

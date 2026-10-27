import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
export function useResource(path, interval = 0, allPages = false) {
  const [state, setState] = useState({ path: null, data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    const load = () =>
      api(path)
        .then(async (data) => {
          if (allPages && data.pages > 1) {
            const rest = await Promise.all(Array.from({ length: data.pages - 1 }, (_, index) =>
              api(`${path}${path.includes('?') ? '&' : '?'}page=${index + 2}`),
            ));
            data = { ...data, items: [...data.items, ...rest.flatMap((page) => page.items)] };
          }
          if (active) setState({ path, data, loading: false, error: '' });
        })
        .catch((error) => {
          if (active)
            setState((s) => ({
              path,
              data: s.path === path ? s.data : null,
              loading: false,
              error: error.message,
            }));
        });
    load();
    const timer = interval ? setInterval(load, interval) : null;
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path, version, interval, allPages]);
  // Never expose the previous endpoint's data shape while a new route/tab loads.
  return state.path === path
    ? { ...state, refresh }
    : { data: null, loading: true, error: '', refresh };
}

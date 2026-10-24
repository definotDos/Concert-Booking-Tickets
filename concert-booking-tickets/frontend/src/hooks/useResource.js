import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
export function useResource(path, interval = 0) {
  const [state, setState] = useState({ path: null, data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    const load = () =>
      api(path)
        .then((data) => {
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
  }, [path, version, interval]);
  // Never expose the previous endpoint's data shape while a new route/tab loads.
  return state.path === path
    ? { ...state, refresh }
    : { data: null, loading: true, error: '', refresh };
}

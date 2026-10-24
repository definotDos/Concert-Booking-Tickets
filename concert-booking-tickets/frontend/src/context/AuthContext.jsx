import { createContext, useEffect, useState } from 'react';
import { api, post, setCsrf } from '../services/api';
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/auth/me')
      .then((data) => {
        setUser(data.user);
        setCsrf(data.csrf);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function authenticate(mode, body) {
    const data = await post(`/auth/${mode}`, body);
    setUser(data.user);
    setCsrf(data.csrf);
    return data.user;
  }
  async function logout() {
    await post('/auth/logout');
    setUser(null);
    setCsrf('');
  }
  async function updateProfile(name) {
    const data = await api('/auth/profile', { method: 'PATCH', body: { name } });
    setUser(data.user);
  }
  return (
    <AuthContext.Provider value={{ user, loading, authenticate, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

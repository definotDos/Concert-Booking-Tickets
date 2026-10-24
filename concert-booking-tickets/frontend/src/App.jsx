import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Layout } from './layouts/Layout';
import { Loading } from './components/UI';
import { Discover } from './pages/Discover';
import { Auth } from './pages/Auth';
import { Concert } from './pages/Concert';
import { Tickets } from './pages/Tickets';
import { Staff } from './pages/Staff';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';
import './App.css';
import './styles/glass.css';
import './styles/discover.css';
import './styles/auth.css';
import './styles/icons.css';
import './styles/concert-vibe.css';
function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return <div className="empty">You do not have access to this page.</div>;
  return children;
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Discover />} />
            <Route path="login" element={<Auth />} />
            <Route
              path="profile"
              element={
                <Protected>
                  <Profile />
                </Protected>
              }
            />
            <Route path="concerts/:id" element={<Concert />} />
            <Route
              path="tickets"
              element={
                <Protected>
                  <Tickets />
                </Protected>
              }
            />
            <Route
              path="staff"
              element={
                <Protected roles={['staff', 'admin']}>
                  <Staff />
                </Protected>
              }
            />
            <Route
              path="admin"
              element={
                <Protected roles={['admin']}>
                  <Admin />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <div className="empty">
                  Page not found. <a href="/">Back to concerts</a>
                </div>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

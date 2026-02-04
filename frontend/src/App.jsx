import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './Login.jsx';
import SetupPage from './SetupPage.jsx';
import PresentationPage from './PresentationPage.jsx';

export default function App() {
  const { token, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-midnight-light dark:bg-midnight flex items-center justify-center text-slate-600 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  if (!token) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/present" element={<PresentationPage />} />
      <Route path="/" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}

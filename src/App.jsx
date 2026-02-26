import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SplashScreen from './components/SplashScreen';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import TravelPlanner from './components/TravelPlanner';
import InvitePage from './components/InvitePage';
import SettingsPage from './components/SettingsPage';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';

const MIN_SPLASH_MS = 1500;

function AppRoutes() {
  const { user, loading } = useAuth();
  const startRef = useRef(Date.now());
  const [splashDone, setSplashDone] = useState(false);

  // 스플래시: 어떤 상황에서도 한 번만, 최소 1.5초 노출
  useEffect(() => {
    if (loading) return;
    const elapsed = Date.now() - startRef.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    if (remaining === 0) setSplashDone(true);
    else {
      const t = setTimeout(() => setSplashDone(true), remaining);
      return () => clearTimeout(t);
    }
  }, [loading]);

  if (!splashDone) return <SplashScreen />;

  // Not authenticated → login
  if (!user) return (
    <>
      <LoginPage />
      <PwaInstallPrompt />
    </>
  );

  // Authenticated → app routes + PWA 설치 툴팁 (웹 진입 시만)
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip/:tripId" element={<TravelPlanner />} />
        <Route path="/invite/:shareCode" element={<InvitePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <PwaInstallPrompt />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

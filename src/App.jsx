import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SplashScreen from './components/SplashScreen';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import TravelPlanner from './components/TravelPlanner';
import InvitePage from './components/InvitePage';

function AppRoutes() {
  const { user, loading } = useAuth();

  // Show splash while checking session
  if (loading) return <SplashScreen />;

  // Not authenticated → login
  if (!user) return <LoginPage />;

  // Authenticated → app routes
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/trip/legacy" element={<TravelPlanner />} />
      <Route path="/trip/:tripId" element={<TravelPlanner />} />
      <Route path="/invite/:shareCode" element={<InvitePage />} />
    </Routes>
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

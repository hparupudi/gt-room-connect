import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth";
import { AuthPage } from "./pages/AuthPage";
import { Discover } from "./pages/Discover";
import { Host } from "./pages/Host";
import { Landing } from "./pages/Landing";
import { MapPage } from "./pages/MapPage";
import { Onboarding } from "./pages/Onboarding";
import { Profile } from "./pages/Profile";
import { Requests } from "./pages/Requests";
import { RoomDetail } from "./pages/RoomDetail";
import { Stay } from "./pages/Stay";

function Gate({ children, requireProfile = true }: { children: ReactNode; requireProfile?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="px-4 py-10 text-sm text-muted">Opening Nook…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireProfile && !user.onboarding_complete) return <Navigate to="/onboarding" replace />;
  if (!requireProfile && user.onboarding_complete) return <Navigate to="/discover" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/" element={loading ? <p className="px-4 py-10 text-sm">Opening Nook…</p> : user ? <Navigate to={user.onboarding_complete ? "/discover" : "/onboarding"} replace /> : <Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/onboarding" element={<Gate requireProfile={false}><Onboarding /></Gate>} />
      <Route path="/discover" element={<Gate><Discover /></Gate>} />
      <Route path="/map" element={<Gate><MapPage /></Gate>} />
      <Route path="/room/:id" element={<Gate><RoomDetail /></Gate>} />
      <Route path="/host" element={<Gate><Host /></Gate>} />
      <Route path="/requests" element={<Gate><Requests /></Gate>} />
      <Route path="/stay/:id" element={<Gate><Stay /></Gate>} />
      <Route path="/profile" element={<Gate><Profile /></Gate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Component } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./auth";
import { AuthPage } from "./pages/AuthPage";
import { Discover } from "./pages/Discover";
import { Host } from "./pages/Host";
import { Landing } from "./pages/Landing";
import { MapPage } from "./pages/MapPage";
import { Messages } from "./pages/Messages";
import { Onboarding } from "./pages/Onboarding";
import { Profile } from "./pages/Profile";
import { Requests } from "./pages/Requests";
import { RoomDetail } from "./pages/RoomDetail";
import { Stay } from "./pages/Stay";

function Gate({ children, requireProfile = true }: { children: ReactNode; requireProfile?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="px-4 py-10 text-sm text-muted">Opening Dormsurf…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireProfile && !user.onboarding_complete) return <Navigate to="/onboarding" replace />;
  if (!requireProfile && user.onboarding_complete) return <Navigate to="/discover" replace />;
  return children;
}

class RouteBoundary extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: "" };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || "This screen hit a snag." };
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-serif text-4xl text-navy">This screen hit a snag.</h1>
        <p className="mt-3 text-sm text-muted">{this.state.message}</p>
        <a href="/discover" className="mt-6 inline-block text-sm text-navy underline">
          Back to Dormsurf
        </a>
      </div>
    );
  }
}

function RoutedApp() {
  const location = useLocation();
  const { user, loading } = useAuth();
  return (
    <RouteBoundary key={location.pathname}>
    <Routes>
      <Route path="/" element={loading ? <p className="px-4 py-10 text-sm">Opening Dormsurf…</p> : user ? <Navigate to={user.onboarding_complete ? "/discover" : "/onboarding"} replace /> : <Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/onboarding" element={<Gate requireProfile={false}><Onboarding /></Gate>} />
      <Route path="/discover" element={<Gate><Discover /></Gate>} />
      <Route path="/map" element={<Gate><MapPage /></Gate>} />
      <Route path="/room/:id" element={<Gate><RoomDetail /></Gate>} />
      <Route path="/host" element={<Gate><Host /></Gate>} />
      <Route path="/requests" element={<Gate><Requests /></Gate>} />
      <Route path="/messages" element={<Gate><Messages /></Gate>} />
      <Route path="/messages/:bookingId" element={<Gate><Messages /></Gate>} />
      <Route path="/stay/:id" element={<Gate><Stay /></Gate>} />
      <Route path="/profile" element={<Gate><Profile /></Gate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </RouteBoundary>
  );
}

export default function App() {
  return <RoutedApp />;
}

import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../auth";
import { Mark } from "./ui";

const LINKS = [
  { to: "/discover", label: "Discover" },
  { to: "/map", label: "Map" },
  { to: "/host", label: "Your couch" },
  { to: "/requests", label: "Requests" },
  { to: "/profile", label: "Profile" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pending = user?.incoming_pending ?? 0;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-24 md:pb-10">
      <header className="flex items-center justify-between gap-4 py-5">
        <NavLink to="/discover" className="flex items-center gap-2">
          <Mark />
          <span className="font-serif text-2xl">Nook</span>
        </NavLink>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm ${isActive ? "bg-navy text-paper" : "text-ink hover:bg-white/70"}`
              }
            >
              {link.label}
              {link.to === "/host" && pending ? ` (${pending})` : ""}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={logout} className="text-sm text-muted hover:text-ink">
          Log out
        </button>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-paper/95 backdrop-blur md:hidden">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `px-1 py-3 text-center text-[11px] ${isActive ? "text-navy font-semibold" : "text-muted"}`}
          >
            {link.label}
            {link.to === "/host" && pending ? ` ${pending}` : ""}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../auth";
import { Mark } from "./ui";

const LINKS = [
  { to: "/discover", label: "Discover", short: "Discover" },
  { to: "/map", label: "Map", short: "Map" },
  { to: "/host", label: "Your space", short: "Space" },
  { to: "/requests", label: "Requests", short: "Requests" },
  { to: "/messages", label: "Messages", short: "Messages" },
  { to: "/profile", label: "Profile", short: "Profile" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pending = user?.incoming_pending ?? 0;
  const unread = user?.inbox_unread ?? 0;
  const asks = user?.roommate_asks?.length ?? 0;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-24 md:pb-10">
      <header className="flex items-center justify-between gap-4 py-5">
        <NavLink to="/discover" className="flex items-center gap-2">
          <Mark />
          <span className="font-serif text-2xl">Dormsurf</span>
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
              <Count link={link.to} pending={pending} unread={unread} asks={asks} />
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={logout} className="text-sm text-muted hover:text-ink">
          Log out
        </button>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-paper/95 backdrop-blur md:hidden">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `flex flex-col items-center px-0.5 py-2 text-center text-[10px] leading-tight ${isActive ? "text-navy font-semibold" : "text-muted"}`}
          >
            {link.short}
            <Count link={link.to} pending={pending} unread={unread} asks={asks} stacked />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Count({
  link,
  pending,
  unread,
  asks,
  stacked = false,
}: {
  link: string;
  pending: number;
  unread: number;
  asks: number;
  stacked?: boolean;
}) {
  const count = link === "/host" ? pending : link === "/messages" ? unread : link === "/requests" ? asks : 0;
  if (!count) return null;
  return (
    <span className={`${stacked ? "mt-0.5" : "ml-1"} rounded-full bg-gold-soft px-1.5 text-[10px] leading-none text-navy`}>
      {count}
    </span>
  );
}

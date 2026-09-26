import type { ReactNode } from "react";

import { tagLabel } from "../format";

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-45";
export const btnPrimary = `${btn} bg-navy text-paper hover:bg-ink`;
export const btnGhost = `${btn} border border-line bg-card text-ink hover:border-navy`;
export const btnDanger = `${btn} border border-clay/30 bg-white text-clay hover:bg-clay hover:text-white`;

export function Banner({ tone = "error", children }: { tone?: "error" | "note"; children: ReactNode }) {
  const styles =
    tone === "note"
      ? "border-gold/40 bg-gold-soft/50 text-ink"
      : "border-clay/30 bg-white text-clay";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const dim = size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm";
  return (
    <div className={`grid ${dim} shrink-0 place-items-center rounded-full bg-navy font-serif text-paper`}>
      {initials || "D"}
    </div>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full bg-gold px-2.5 py-1 text-xs font-medium text-paper">
          {tagLabel(tag)}
        </li>
      ))}
    </ul>
  );
}

export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#003057" />
      <path d="M8.4 16.2 16 8.4l7.6 7.8V21H8.4z" fill="#f3efe6" />
      <path d="M14.35 16.7h3.3V21h-3.3z" fill="#d4b56a" />
      <path
        d="M6.2 24.5c2-1.7 3.15-1.7 5.15 0s3.15 1.7 5.15 0 3.15-1.7 5.15 0 3 1.55 4.15 0"
        fill="none"
        stroke="#e7d7a8"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

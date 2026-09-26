import type { ReactNode } from "react";

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
      {initials || "N"}
    </div>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink">
          {tag}
        </li>
      ))}
    </ul>
  );
}

export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#003057" />
      <path d="M8 23.5V9.5h7.2a4.2 4.2 0 0 1 0 8.4H8" fill="none" stroke="#f3efe6" strokeWidth="1.8" />
      <circle cx="22.5" cy="21" r="2.1" fill="#e7d7a8" />
    </svg>
  );
}

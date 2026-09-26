import type { SocialLink, Socials } from "../types";

const ORDER = ["instagram", "whatsapp", "discord"] as const;

export function SocialLogos({ socials }: { socials: Socials }) {
  const items = ORDER.flatMap((id) => {
    const link = socials.links?.[id];
    return link ? [{ id, ...link }] : [];
  });
  if (!items.length) {
    return <p className="mt-3 text-sm opacity-80">They haven't added a handle yet. You still have this thread.</p>;
  }
  return (
    <ul className="mt-4 flex flex-wrap gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            aria-label={item.label}
            title={item.label}
            className="flex w-24 flex-col items-center gap-1.5 rounded-2xl border border-line bg-card px-2 py-3 text-ink hover:border-navy"
          >
            <Logo id={item.id} />
            <span className="text-center text-xs leading-4">{caption(item.id, item.kind)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function caption(id: (typeof ORDER)[number], kind: SocialLink["kind"]): string {
  if (id === "instagram") return kind === "profile" ? "Follow" : "Message";
  if (id === "discord") return kind === "profile" ? "Add friend" : "Message";
  return "Message";
}

function Logo({ id }: { id: (typeof ORDER)[number] }) {
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#E1306C" />
        <rect x="7" y="7" width="18" height="18" rx="5" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="16" cy="16" r="4" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="22.2" cy="9.8" r="1.2" fill="white" />
      </svg>
    );
  }
  if (id === "whatsapp") {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#25D366" />
        <path
          fill="white"
          d="M16.2 7.8a8.1 8.1 0 0 0-6.9 12.3L8 24.2l4.2-1.1a8.1 8.1 0 0 0 4 1 8.2 8.2 0 1 0 0-16.3Zm4.7 11.6c-.2.6-1.1 1-1.8 1.1-.5.1-1 .1-3.3-.7-2.8-1-4.6-3.6-4.7-3.8-.2-.2-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5.2.6.8 2 .8 2.1.1.2 0 .3-.1.5l-.4.5c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1.9 2 1.1 2.3 1.3.3.1.4.1.6-.1l.7-.8c.2-.2.3-.2.6-.1.2.1 1.6.8 1.9.9.3.2.4.2.5.3.1.2 0 .7-.2 1.3Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#5865F2" />
      <path
        fill="white"
        d="M22.7 10.2A13 13 0 0 0 8.4 20.6l-1.3 4.5 4.6-1.2a10.4 10.4 0 0 0 4.4 1 10.5 10.5 0 0 0 6.6-14.7ZM13.4 18.6c-.6.1-1.2-.4-1.2-.4a4.8 4.8 0 0 1-1.5-2.2c0-.5.4-.9.8-.9h.6l.5 1.2.4 1c.1.2.3.3.5.2.6-.2 1.1-.6 1.5-1 .1-.2.4-.2.5 0 .4.3 1.2.6 1.4.7.2.1.2.3 0 .5-.3.4-1.1.9-1.6 1.1-.3.1-.4.3-.4.6 0 .4.5.7.8.8 1.2.4 2.6.1 3.6-.6a5.4 5.4 0 0 0 1.6-3.2c0-.3.2-.5.5-.5h.5c.4 0 .7.4.6.8a6.6 6.6 0 0 1-2.2 3.8 7.2 7.2 0 0 1-4.4 1.5c-.5 0-1.1 0-1.6-.2Z"
      />
    </svg>
  );
}

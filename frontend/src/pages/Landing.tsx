import { Link } from "react-router-dom";

import { Mark, btnGhost, btnPrimary } from "../components/ui";

const STEPS = [
  {
    title: "Prove you're at Tech",
    copy: "We'll send a code to your @gatech.edu email so we know it's you.",
  },
  {
    title: "Say how you live",
    copy: "Record your habits and stop whenever you're done. A short take is saved if it actually covers them.",
  },
  {
    title: "Ask, then decide",
    copy: "You request a couch. They read your profile and accept. Socials stay hidden until you both say yes.",
  },
];

export function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <Mark />
          <span className="font-serif text-2xl">Nook</span>
        </div>
        <div className="flex gap-2">
          <Link to="/login" className={btnGhost}>
            Log in
          </Link>
          <Link to="/signup" className={btnPrimary}>
            Sign up
          </Link>
        </div>
      </header>
      <section className="grid items-end gap-10 py-10 md:grid-cols-[1.3fr_0.7fr] md:py-16">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-gold uppercase">Georgia Tech · weekend housing</p>
          <h1 className="mt-3 max-w-xl font-serif text-5xl leading-[1.02] text-navy md:text-7xl">
            Your roommate left town. Someone on campus has a couch.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            Nook is how Yellow Jackets spend a night in another hall — not a rental, a person. Match on how you live, or on the walk from your own room.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className={btnPrimary}>
              Find a couch
            </Link>
            <Link to="/signup" className={btnGhost}>
              Offer yours
            </Link>
          </div>
        </div>
        <aside className="rounded-[28px] border border-line bg-card p-5">
          <p className="text-xs tracking-[0.16em] text-gold uppercase">This weekend, roughly</p>
          <ul className="mt-4 space-y-4">
            {[
              ["Glenn 314", "Early, tidy, climbing and studio nights"],
              ["Field 405", "Late concerts, a tidy double"],
              ["North Ave East 508", "Music after basketball"],
            ].map(([place, line]) => (
              <li key={place} className="border-b border-line pb-3 last:border-0">
                <p className="font-serif text-2xl">{place}</p>
                <p className="text-sm text-muted">{line}</p>
              </li>
            ))}
          </ul>
        </aside>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <article key={step.title} className="rounded-[28px] border border-line bg-white/60 p-5">
            <p className="font-serif text-gold">{index + 1}.</p>
            <h2 className="mt-2 font-serif text-2xl">{step.title}</h2>
            <p className="mt-2 text-sm text-muted">{step.copy}</p>
          </article>
        ))}
      </section>
      <p className="mt-10 text-xs text-muted">Not affiliated with Georgia Tech Housing. Be a decent guest.</p>
    </div>
  );
}

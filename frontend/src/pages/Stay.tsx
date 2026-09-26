import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Shell } from "../components/Shell";
import { Avatar, Banner } from "../components/ui";
import { formatDates } from "../format";
import type { Booking, Socials } from "../types";

export function Stay() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ booking: Booking }>(`/api/bookings/${id}`, {}, token)
      .then((body) => setBooking(body.booking))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "That stay isn't available."));
  }, [id, token]);

  const other = booking ? (booking.role === "guest" ? booking.host : booking.guest) : null;

  return (
    <Shell>
      <Link to={booking?.role === "host" ? "/host" : "/requests"} className="text-sm text-navy">
        Back
      </Link>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      {booking && other ? (
        <article className="mt-4 max-w-2xl">
          <p className="text-xs tracking-[0.16em] text-gold uppercase">{booking.status}</p>
          <h1 className="font-serif text-5xl text-navy">
            {booking.status === "accepted" ? `You're set for ${formatDates(booking.dates)}` : `Request for ${formatDates(booking.dates)}`}
          </h1>
          <p className="mt-2 text-muted">
            {booking.host.dorm_name} {booking.host.unit}
            {booking.host.address ? ` · ${booking.host.address}` : ""}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Avatar name={other.name} size="lg" />
            <div>
              <p className="font-serif text-2xl">{other.name}</p>
              <p className="text-sm text-muted">
                {other.year_label} · {other.major} · {other.hometown}
              </p>
            </div>
          </div>
          <p className="mt-4 leading-7">{other.bio}</p>
          {booking.message ? <p className="mt-3 text-sm text-navy">Note: {booking.message}</p> : null}
          {booking.status === "accepted" && other.socials ? (
            <div className="mt-6 rounded-[28px] bg-navy p-5 text-paper">
              <p className="text-xs tracking-[0.16em] text-gold-soft uppercase">Coordinate from here</p>
              <p className="mt-2 font-serif text-3xl">Trade the details yourselves.</p>
              <SocialList socials={other.socials} />
              {user?.socials ? (
                <p className="mt-4 text-sm text-gold-soft">They can see your socials too: {listed(user.socials)}.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">
              {booking.status === "pending"
                ? "Still waiting. Socials stay hidden until this is accepted."
                : booking.decline_reason || "This one didn't turn into a stay."}
            </p>
          )}
        </article>
      ) : null}
    </Shell>
  );
}

function SocialList({ socials }: { socials: Socials }) {
  const rows = [
    socials.instagram ? ["Instagram", socials.instagram] : null,
    socials.phone ? ["Phone", socials.phone] : null,
    socials.discord ? ["Discord", socials.discord] : null,
  ].filter(Boolean) as string[][];
  return (
    <ul className="mt-4 space-y-2 text-lg">
      {rows.map(([label, value]) => (
        <li key={label}>
          <span className="text-gold-soft">{label}</span> · {value}
        </li>
      ))}
      {rows.length === 0 ? <li>They haven't added socials yet. You still have their name and hall.</li> : null}
    </ul>
  );
}

function listed(socials: Socials): string {
  return [socials.instagram, socials.phone, socials.discord].filter(Boolean).join(", ") || "the ones on your profile";
}

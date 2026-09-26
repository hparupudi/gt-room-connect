import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Shell } from "../components/Shell";
import { WhyMatch } from "../components/WhyMatch";
import { Banner, btnGhost } from "../components/ui";
import { formatDates, matchPercent } from "../format";
import type { Booking } from "../types";

export function Requests() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const body = await api<{ bookings: Booking[] }>("/api/bookings/outgoing", {}, token);
    setBookings(body.bookings);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Couldn't load requests."));
  }, [token]);

  async function cancel(id: string) {
    try {
      await api(`/api/bookings/${id}/cancel`, { method: "POST" }, token);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel that request.");
    }
  }

  return (
    <Shell>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Requests</p>
      <h1 className="font-serif text-4xl text-navy">Waiting on a yes.</h1>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <div className="mt-6 grid gap-3">
        {bookings.length === 0 ? <p className="text-sm text-muted">You haven't asked anyone yet. Discover is where the open couches are.</p> : null}
        {bookings.map((booking) => (
          <article key={booking.id} className="rounded-[28px] border border-line bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.14em] text-gold uppercase">{booking.status}</p>
                <h2 className="font-serif text-3xl">{booking.host.name}</h2>
                <p className="text-sm text-muted">
                  {booking.host.dorm_name} {booking.host.unit} · {formatDates(booking.dates)} · {matchPercent(booking.match)} match · {booking.minutes} min
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/stay/${booking.id}`} className={btnGhost}>
                  Open
                </Link>
                {booking.status === "accepted" ? (
                  <Link to={`/messages/${booking.id}`} className={btnGhost}>
                    Messages
                  </Link>
                ) : null}
                {booking.status === "pending" ? (
                  <button type="button" className={btnGhost} onClick={() => cancel(booking.id)}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
            <WhyMatch reason={booking.reason} model={booking.reason_model} />
            {booking.decline_reason ? <p className="mt-2 text-sm text-muted">{booking.decline_reason}</p> : null}
            {booking.status === "accepted" ? (
              <p className="mt-2 text-sm text-moss">
                You're in. The thread stays on this stay, and it's also in{" "}
                <Link to={`/messages/${booking.id}`} className="underline">
                  Messages
                </Link>
                .
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </Shell>
  );
}

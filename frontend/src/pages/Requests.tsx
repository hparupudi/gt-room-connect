import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Shell } from "../components/Shell";
import { WhyMatch } from "../components/WhyMatch";
import { Banner, btnGhost, btnPrimary } from "../components/ui";
import { formatDates, matchPercent } from "../format";
import type { Booking, RoommateAsk } from "../types";

export function Requests() {
  const { token, refresh } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [asks, setAsks] = useState<RoommateAsk[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [body, consent] = await Promise.all([
      api<{ bookings: Booking[] }>("/api/bookings/outgoing", {}, token),
      api<{ asks: RoommateAsk[] }>("/api/roommate-asks", {}, token),
    ]);
    setBookings(body.bookings);
    setAsks(consent.asks);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Couldn't load requests."));
  }, [token]);

  async function answer(id: string, accept: boolean) {
    setError("");
    try {
      await api(`/api/roommate-asks/${id}/${accept ? "accept" : "decline"}`, { method: "POST" }, token);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that agreement.");
    }
  }

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
      {asks.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="font-serif text-2xl">Roommate agreement</h2>
          {asks.map((ask) => (
            <article key={ask.id} className="rounded-[28px] border border-line bg-card p-5">
              <p className="text-xs tracking-[0.14em] text-gold uppercase">Waiting on you</p>
              <h3 className="font-serif text-3xl">{ask.host_name}</h3>
              <p className="text-sm text-muted">
                {ask.dorm_name} {ask.unit} can be booked after you agree.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className={btnPrimary} onClick={() => void answer(ask.id, true)}>
                  I agree
                </button>
                <button type="button" className={btnGhost} onClick={() => void answer(ask.id, false)}>
                  Decline
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      <div className="mt-6 grid gap-3">
        {bookings.length === 0 ? <p className="text-sm text-muted">You haven't asked anyone yet. Discover is where the open beds are.</p> : null}
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

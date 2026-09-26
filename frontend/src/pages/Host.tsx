import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { DormBrowser } from "../components/DormBrowser";
import { Shell } from "../components/Shell";
import { WhyMatch } from "../components/WhyMatch";
import { Avatar, Banner, btnDanger, btnGhost, btnPrimary } from "../components/ui";
import { formatDates, isoDate, matchPercent, upcomingDays } from "../format";
import type { Booking, User } from "../types";

export function Host() {
  const { token, refresh } = useAuth();
  const [me, setMe] = useState<User | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [claim, setClaim] = useState<{ dormId: string; dormName: string; floor: number; unit: string } | null>(null);
  const [roommateEmail, setRoommateEmail] = useState("");
  const days = upcomingDays(42);

  async function load() {
    const [profile, requests] = await Promise.all([
      api<{ user: User }>("/api/auth/me", {}, token),
      api<{ bookings: Booking[] }>("/api/bookings/incoming", {}, token),
    ]);
    setMe(profile.user);
    setSelected(profile.user.open_dates);
    setIncoming(requests.bookings);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Couldn't load your space."));
  }, [token]);

  async function claimRoom() {
    if (!claim) return;
    setError("");
    setNote("");
    try {
      const body = await api<{ user: User }>(
        "/api/me/room",
        { method: "POST", body: JSON.stringify({ dorm_id: claim.dormId, floor: claim.floor, unit: claim.unit }) },
        token,
      );
      setMe(body.user);
      setSelected(body.user.open_dates);
      setClaim(null);
      setNote(
        body.user.roommates_needed
          ? "Room saved. Add your roommate, then pick the nights your bed is free."
          : "Room saved. Pick the nights your bed is free.",
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that room.");
    }
  }

  async function addRoommate(event: FormEvent) {
    event.preventDefault();
    const email = roommateEmail.trim();
    if (!email) return;
    setError("");
    setNote("");
    try {
      const body = await api<{ user: User }>("/api/me/roommates", { method: "POST", body: JSON.stringify({ email }) }, token);
      setMe(body.user);
      setSelected(body.user.open_dates);
      setRoommateEmail("");
      setNote(`Asked ${email} to agree before this bed can be booked.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that roommate.");
    }
  }

  async function removeRoommate(id: string) {
    setError("");
    try {
      const body = await api<{ user: User }>(`/api/me/roommates/${id}`, { method: "DELETE" }, token);
      setMe(body.user);
      setSelected(body.user.open_dates);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that roommate.");
    }
  }

  async function save() {
    setError("");
    setNote("");
    try {
      const body = await api<{ user: User }>("/api/me/availability", { method: "PUT", body: JSON.stringify({ dates: selected }) }, token);
      setMe(body.user);
      setSelected(body.user.open_dates);
      setNote("Your open nights are updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save those dates.");
    }
  }

  async function respond(id: string, action: "accept" | "decline") {
    setError("");
    try {
      await api(`/api/bookings/${id}/${action}`, { method: "POST" }, token);
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that request.");
    }
  }

  const today = isoDate(new Date());

  return (
    <Shell>
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Your space</p>
      <h1 className="font-serif text-4xl text-navy">
        {!me ? "Your space" : me.dorm_name ? `${me.dorm_name} ${me.unit}` : "Off campus"}
      </h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        {me && !me.dorm_id
          ? "You can request a bed from Discover. Opening your own space needs a Georgia Tech room."
          : "Nights you turn on show up in search after your roommates agree. When someone requests them, you read their profile and decide. Socials stay hidden until you accept."}
      </p>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      {note ? (
        <div className="mt-4">
          <Banner tone="note">{note}</Banner>
        </div>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {!me ? (
          <p className="text-sm text-muted">Loading your space…</p>
        ) : !me.dorm_id ? (
          <section className="space-y-4">
            <DormBrowser dates={[]} mode="pick" pickedUnit={claim?.unit} onPick={setClaim} />
            <button type="button" className={btnPrimary} disabled={!claim} onClick={() => void claimRoom()}>
              {claim ? `This is my room · ${claim.dormName} ${claim.unit}` : "Select a unit to host"}
            </button>
          </section>
        ) : (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-line bg-card p-5">
            <h2 className="font-serif text-2xl">Roommates</h2>
            <p className="mt-1 text-sm text-muted">
              {me.room_bookable
                ? me.roommates?.length
                  ? "They agreed. Nights you turn on show up in search."
                  : "This bedroom is yours alone. Nights you turn on show up in search."
                : me.roommates_needed
                  ? "Add the person you live with. This bed stays hidden until they agree."
                  : "This bedroom is yours alone. Add someone else only if they should agree before the bed is booked."}
            </p>
            <ul className="mt-4 space-y-2">
              {(me?.roommates || []).map((roommate) => (
                <li key={roommate.id} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{roommate.name}</p>
                    <p className="text-xs text-muted">
                      {roommate.email} · {roommate.status === "accepted" ? "Agreed" : roommate.status === "declined" ? "Declined" : "Waiting"}
                    </p>
                  </div>
                  <button type="button" className="text-sm text-navy underline" onClick={() => void removeRoommate(roommate.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {(me?.roommates || []).length === 0 ? <p className="mt-3 text-sm text-muted">No roommates added yet.</p> : null}
            <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => void addRoommate(event)}>
              <input
                type="email"
                className="min-w-0 flex-1"
                placeholder="roommate@school.edu"
                value={roommateEmail}
                onChange={(event) => setRoommateEmail(event.target.value)}
              />
              <button type="submit" className={btnGhost}>
                Add roommate
              </button>
            </form>
            {!me.room_bookable ? <p className="mt-3 text-sm text-clay">{consentNote(me)}</p> : null}
          </div>
        <section className="rounded-[28px] border border-line bg-card p-5">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <div key={`${label}${index}`}>{label}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {padDays(days).map((day, index) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  disabled={day < today}
                  onClick={() => setSelected((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]))}
                  className={`rounded-lg py-3 text-sm disabled:opacity-30 ${selected.includes(day) ? "bg-moss text-white" : "bg-paper"}`}
                >
                  {Number(day.slice(-2))}
                </button>
              ) : (
                <div key={`pad-${index}`} />
              ),
            )}
          </div>
          <button type="button" className={`${btnPrimary} mt-4`} disabled={Boolean(selected.length && !me.room_bookable)} onClick={save}>
            Save open nights
          </button>
          <p className="mt-2 text-sm text-muted">{selected.length ? `Open ${formatDates(selected)}` : "Your space is hidden until you pick nights."}</p>
        </section>
        </section>
        )}
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Requests</h2>
          {incoming.length === 0 ? <p className="text-sm text-muted">No one has asked yet. Open a weekend and check back.</p> : null}
          {incoming.map((booking) => (
            <article key={booking.id} className="rounded-3xl border border-line bg-card p-4">
              <div className="flex items-start gap-3">
                <Avatar name={booking.guest.name} />
                <div>
                  <p className="font-medium">{booking.guest.name}</p>
                  <p className="text-sm text-muted">
                    {booking.guest.year_label} · {booking.guest.major}
                  </p>
                  <p className="text-sm">{formatDates(booking.dates)} · {matchPercent(booking.match)} match</p>
                </div>
              </div>
              <WhyMatch reason={booking.reason} model={booking.reason_model} />
              <p className="mt-2 text-sm">{booking.guest.bio}</p>
              {booking.message ? <p className="mt-2 text-sm text-navy">“{booking.message}”</p> : null}
              <p className="mt-2 text-xs tracking-wide text-muted uppercase">{booking.status}</p>
              {booking.status === "pending" ? (
                <div className="mt-3 flex gap-2">
                  <button type="button" className={btnPrimary} onClick={() => respond(booking.id, "accept")}>
                    Accept
                  </button>
                  <button type="button" className={btnDanger} onClick={() => respond(booking.id, "decline")}>
                    Decline
                  </button>
                </div>
              ) : null}
              {booking.status === "accepted" ? (
                <div className="mt-3 flex gap-3 text-sm">
                  <Link to={`/stay/${booking.id}`} className="text-navy underline">
                    Coordinate
                  </Link>
                  <Link to={`/messages/${booking.id}`} className="text-navy underline">
                    Messages
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </Shell>
  );
}

function consentNote(user: User): string {
  const rows = user.roommates || [];
  if (rows.some((row) => row.status === "declined")) {
    return "A roommate declined. Remove them and add someone who agrees before this bed can be booked.";
  }
  if (rows.some((row) => row.status === "pending")) {
    return "This bed stays hidden until your roommate agrees.";
  }
  if ((user.roommates_needed || 0) > 1) {
    return `Add ${user.roommates_needed} roommates and wait for them to agree before this bed can be booked.`;
  }
  if (user.roommates_needed) {
    return "Add your roommate and wait for them to agree before this bed can be booked.";
  }
  return "This bed stays hidden until every roommate you added agrees.";
}

function padDays(days: string[]): Array<string | null> {
  if (!days.length) return [];
  const first = new Date(`${days[0]}T00:00:00`);
  return [...Array.from({ length: first.getDay() }, () => null), ...days];
}

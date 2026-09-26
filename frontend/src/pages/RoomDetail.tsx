import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { CampusMap } from "../components/CampusMap";
import { SocialLogos } from "../components/SocialLogos";
import { Shell } from "../components/Shell";
import { WhyMatch } from "../components/WhyMatch";
import { Avatar, Banner, Tags, btnGhost, btnPrimary } from "../components/ui";
import { useDates } from "../dates";
import { formatDates, matchPercent, sleepLabel, styleLabel } from "../format";
import type { MapData, Route, Score, User } from "../types";

export function RoomDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { dates } = useDates();
  const navigate = useNavigate();
  const [host, setHost] = useState<User | null>(null);
  const [scores, setScores] = useState<Score | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [map, setMap] = useState<MapData | null>(null);

  useEffect(() => {
    api<{ host: User; scores?: Score }>(`/api/hosts/${id}`, {}, token)
      .then((body) => {
        setHost(body.host);
        setScores(body.scores ?? null);
        const open = new Set(body.host.open_dates);
        setChosen(dates.filter((day) => open.has(day)));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "That profile isn't available."));
  }, [id, token, dates]);

  useEffect(() => {
    if (!host?.dorm_id || !user?.dorm_id || host.id === user.id) return;
    const params = new URLSearchParams({ to: host.dorm_id });
    if (host.unit) params.set("to_unit", host.unit);
    api<Route>(`/api/directions?${params}`, {}, token)
      .then(setRoute)
      .catch(() => setRoute(null));
    api<MapData>("/api/map", {}, token)
      .then(setMap)
      .catch(() => setMap(null));
  }, [host, user, token]);

  async function requestStay() {
    if (!host) return;
    setBusy(true);
    setError("");
    try {
      const body = await api<{ booking: { id: string } }>(
        "/api/bookings",
        { method: "POST", body: JSON.stringify({ host_id: host.id, dates: chosen, message }) },
        token,
      );
      navigate(`/stay/${body.booking.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The request didn't send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      {error ? <Banner>{error}</Banner> : null}
      {!host ? <p className="text-sm text-muted">Loading the room…</p> : null}
      {host ? (
        <article className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <Link to="/discover" className="text-sm text-navy">
              Back to results
            </Link>
            <div className="mt-3 flex items-start gap-4">
              <Avatar name={host.name} size="lg" />
              <div>
                <p className="text-xs tracking-[0.16em] text-gold uppercase">
                  {host.dorm_name} {host.unit} · floor {host.floor} · {styleLabel(host.style)}
                </p>
                <h1 className="font-serif text-5xl text-navy">{host.name}</h1>
                <p className="text-muted">
                  {host.year_label} · {host.major} · {host.age} · {host.hometown}
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-lg leading-8">{host.bio}</p>
            {scores ? <WhyMatch reason={scores.reason} model={scores.reason_model} /> : null}
            <div className="mt-4">
              <Tags tags={host.tags} />
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Stat label="Sleep" value={`${sleepLabel(host.sleep_timing)} · ${host.sleep_start ?? ""}`} />
              <Stat label="Cleanliness" value={host.cleanliness || ""} />
              <Stat label="Noise" value={host.noise || ""} />
              <Stat label="Walk" value={route ? `${route.minutes} min` : scores ? `${scores.minutes} min` : "—"} />
            </dl>
            <p className="mt-4 text-sm">{host.guest_notes}</p>
            {route && map && user?.id !== host.id ? (
              <section className="mt-6">
                <h2 className="font-serif text-2xl">
                  The walk from {user?.dorm_name} {user?.unit}
                </h2>
                <p className="mb-3 text-sm text-muted">
                  {route.minutes} minutes, {(route.meters / 1000).toFixed(1)} km, ending at {host.dorm_name} {host.unit} on floor{" "}
                  {host.floor}.
                </p>
                <CampusMap dorms={map.dorms} route={route} height="320px" interactive={false} />
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-navy">Turn by turn</summary>
                  <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-muted">
                    {route.steps.map((step, index) => (
                      <li key={`${index}-${step}`}>{step}</li>
                    ))}
                  </ol>
                </details>
                {route.maps_url ? (
                  <a className={`${btnGhost} mt-3`} href={route.maps_url} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                ) : null}
              </section>
            ) : null}
            {host.socials_visible && host.socials ? (
              <div className="mt-4 rounded-2xl bg-moss-soft p-4 text-sm">
                <p className="font-medium">You're matched. Here's how to coordinate.</p>
                <SocialLogos socials={host.socials} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Socials show up after they accept.</p>
            )}
          </div>
          <aside className="h-fit rounded-[28px] border border-line bg-card p-5">
            {user?.id === host.id ? (
              <>
                <p className="font-serif text-2xl">This is your room.</p>
                <Link to="/host" className={`${btnPrimary} mt-4`}>
                  Manage your couch
                </Link>
              </>
            ) : (
              <>
                <p className="font-serif text-3xl">{scores ? matchPercent(scores.match) : ""}</p>
                <p className="text-sm text-muted">match · {scores ? `${scores.minutes} min walk` : ""}</p>
                <p className="mt-4 text-sm font-medium">Nights you want</p>
                <ul className="mt-2 space-y-1">
                  {host.open_dates.map((day) => (
                    <li key={day}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={chosen.includes(day)}
                          onChange={() =>
                            setChosen((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]))
                          }
                        />
                        {formatDates([day])}
                      </label>
                    </li>
                  ))}
                </ul>
                {!host.open_dates.length ? <p className="text-sm text-muted">No open nights right now.</p> : null}
                <label className="mt-4 block text-sm">
                  <span className="mb-1.5 block font-medium">Note</span>
                  <textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Why these nights, and anything they should know." />
                </label>
                <button type="button" className={`${btnPrimary} mt-4 w-full`} disabled={busy || chosen.length === 0} onClick={requestStay}>
                  {busy ? "Sending…" : "Request this couch"}
                </button>
              </>
            )}
          </aside>
        </article>
      ) : null}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}

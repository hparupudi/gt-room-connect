import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { styleLabel } from "../format";
import type { DormDetail, DormPin, MapData, Route, RoomShape } from "../types";
import { CampusMap } from "./CampusMap";
import { FloorPlan } from "./FloorPlan";
import { RoomFacts } from "./RoomFacts";
import { Banner, btnGhost, btnPrimary } from "./ui";

type Pick = { dormId: string; dormName: string; floor: number; unit: string };
type Endpoint = { dormId: string; unit: string };

export function DormBrowser({
  dates,
  mode,
  pickedUnit,
  onPick,
}: {
  dates: string[];
  mode: "browse" | "pick";
  pickedUnit?: string;
  onPick?: (pick: Pick) => void;
}) {
  const { token, user } = useAuth();
  const [map, setMap] = useState<MapData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [zoomToId, setZoomToId] = useState("");
  const [detail, setDetail] = useState<DormDetail | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState<Endpoint | null>(null);
  const [destination, setDestination] = useState<Endpoint | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    if (user?.dorm_id && user.unit && !origin) setOrigin({ dormId: user.dorm_id, unit: user.unit });
  }, [user, origin]);

  const dateKey = dates.join(",");

  useEffect(() => {
    const query = dateKey ? `?dates=${dateKey}` : "";
    api<MapData>(`/api/map${query}`, {}, token)
      .then((data) => {
        setMap(data);
        setSelectedId((current) => current || data.home || "");
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "The map didn't load."));
  }, [dateKey, token]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const query = dateKey ? `?dates=${dateKey}` : "";
    api<{ dorm: DormDetail }>(`/api/dorms/${selectedId}${query}`, {}, token)
      .then((body) => {
        setDetail(body.dorm);
        setFloor((current) =>
          current && body.dorm.floors.some((item) => item.floor === current) ? current : body.dorm.floors[0]?.floor ?? null,
        );
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "That hall didn't load."));
  }, [selectedId, dateKey, token]);

  useEffect(() => {
    if (mode !== "browse" || !origin?.dormId || !destination?.dormId) {
      setRoute(null);
      return;
    }
    setRouting(true);
    const params = new URLSearchParams({ from: origin.dormId, to: destination.dormId });
    if (origin.unit) params.set("from_unit", origin.unit);
    if (destination.unit) params.set("to_unit", destination.unit);
    api<Route>(`/api/directions?${params}`, {}, token)
      .then(setRoute)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Directions didn't load."))
      .finally(() => setRouting(false));
  }, [origin, destination, mode, token]);

  const dorms = map?.dorms ?? [];
  const byId = useMemo(() => Object.fromEntries(dorms.map((dorm) => [dorm.id, dorm])), [dorms]);
  const plan = detail?.floors.find((item) => item.floor === floor) ?? null;
  const destinationRoom = useMemo(() => {
    if (!destination || !detail || detail.id !== destination.dormId) return null;
    for (const level of detail.floors) {
      const room = level.rooms.find((item) => item.unit === destination.unit);
      if (room) return room;
    }
    return null;
  }, [destination, detail]);

  function selectHall(id: string) {
    setSelectedId(id);
    setZoomToId(id);
    setFloor(null);
  }

  function chooseDestination(next: Endpoint | null) {
    setDestination(next);
    if (next?.dormId && next.dormId !== selectedId) selectHall(next.dormId);
  }

  useEffect(() => {
    if (destinationRoom && detail) {
      const level = detail.floors.find((item) => item.rooms.some((room) => room.unit === destinationRoom.unit));
      if (level && level.floor !== floor) setFloor(level.floor);
    }
    // Follow the destination when it changes, not when the user browses floors.
  }, [destinationRoom?.unit, detail?.id]);

  function chooseUnit(room: RoomShape) {
    if (!detail || !plan) return;
    if (mode === "pick") {
      onPick?.({ dormId: detail.id, dormName: detail.name, floor: plan.floor, unit: room.unit });
      return;
    }
    setDestination({ dormId: detail.id, unit: room.unit });
  }

  if (error && !map) return <Banner>{error}</Banner>;
  if (!map) return <p className="text-sm text-muted">Loading the campus…</p>;

  const sorted = [...dorms].sort((a, b) => a.name.localeCompare(b.name));
  const highlightUnit = mode === "pick" ? pickedUnit : destination && detail?.id === destination.dormId ? destination.unit : undefined;

  return (
    <div className="space-y-5">
      {error ? <Banner>{error}</Banner> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm">
              <span className="sr-only">Jump to a hall</span>
              <select value={selectedId} onChange={(event) => selectHall(event.target.value)} className="min-w-64">
                <option value="">Choose a residence hall</option>
                {sorted.map((dorm) => (
                  <option key={dorm.id} value={dorm.id}>
                    {dorm.name}
                    {dorm.yours ? " · your hall" : dorm.open_units ? ` · ${dorm.open_units} open` : ""}
                  </option>
                ))}
              </select>
            </label>
            <ul className="flex flex-wrap gap-3 text-xs text-muted">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-moss" /> Hosting
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-navy" /> Your hall
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#8d8476]" /> Quiet
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-gold" /> Your walk
              </li>
            </ul>
          </div>
          <CampusMap
            dorms={dorms}
            selectedId={selectedId}
            zoomToId={zoomToId}
            onSelect={selectHall}
            route={mode === "browse" ? route : null}
          />
          <p className="text-xs text-muted">
            Map data and building outlines © OpenStreetMap contributors. Walking routes follow OpenStreetMap paths via Valhalla.
          </p>
        </div>
        <aside className="space-y-4 rounded-[28px] border border-line bg-card p-5">
          {detail ? (
            <>
              <div>
                <p className="text-xs tracking-[0.16em] text-gold uppercase">
                  {styleLabel(detail.style)} · {detail.campus} campus
                </p>
                <h2 className="font-serif text-3xl">{detail.name}</h2>
                <p className="text-sm text-muted">{detail.address}</p>
                {detail.note ? <p className="mt-2 text-sm">{detail.note}</p> : null}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Spec label="Floors" value={String(detail.floors.length)} />
                <Spec label="Rooms on this floor" value={String(plan ? plan.rooms.length : detail.units_per_floor)} />
                <Spec label="Rooms" value={detail.specs.room} wide />
                <Spec label="Bath" value={detail.specs.bath} wide />
                <Spec label="Kitchen" value={detail.specs.kitchen} wide />
                <Spec label="Where a guest sleeps" value={detail.specs.guest_space} wide />
              </dl>
              <p className="text-sm">
                {detail.open_units
                  ? `${detail.open_units} unit${detail.open_units === 1 ? "" : "s"} hosting on these dates.`
                  : "Nobody in this hall is hosting those nights."}
              </p>
              {mode === "browse" ? (
                <Navigator
                  dorms={sorted}
                  byId={byId}
                  origin={origin}
                  destination={destination}
                  onOrigin={setOrigin}
                  onDestination={chooseDestination}
                  route={route}
                  routing={routing}
                  destinationRoom={destinationRoom}
                />
              ) : null}
            </>
          ) : (
            <div>
              <h2 className="font-serif text-2xl">Pick a hall</h2>
              <p className="mt-1 text-sm text-muted">
                Click a building on the map. Green halls have someone hosting on your dates. You'll get the floor plan and the walk from
                your room.
              </p>
            </div>
          )}
        </aside>
      </div>
      {detail ? (
        <section className="rounded-[28px] border border-line bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-2xl">
              {detail.name} floor plan
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {detail.floors.map((item) => (
                <button
                  key={item.floor}
                  type="button"
                  onClick={() => setFloor(item.floor)}
                  className={`rounded-full px-3 py-1 text-sm ${item.floor === floor ? "bg-navy text-paper" : "bg-paper"}`}
                >
                  Floor {item.floor}
                  {item.open_units ? ` · ${item.open_units}` : ""}
                </button>
              ))}
            </div>
          </div>
          {plan ? (
            <FloorPlan key={`${detail.id}-${plan.floor}`} plan={plan} selectedUnit={highlightUnit} onSelect={chooseUnit} />
          ) : null}
          {highlightUnit && plan?.rooms.some((room) => room.unit === highlightUnit) ? (
            <div className="mt-4">
              <RoomFacts unit={highlightUnit} housing={detail.housing} />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            {plan?.image
              ? mode === "pick"
                ? "The plan above is the Housing drawing for this floor. Choose your unit underneath it. Roommates can both live in a double."
                : "The plan above is the Housing drawing for this floor, including bathrooms and study spaces. Choose a unit underneath it for who's hosting and for walking directions."
              : mode === "pick"
                ? "Click a unit to claim it as yours. Roommates can both live in a double."
                : "Hover a unit for who's hosting. Click any unit to get walking directions to it from your room."}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Spec({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl bg-paper px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Navigator({
  dorms,
  byId,
  origin,
  destination,
  onOrigin,
  onDestination,
  route,
  routing,
  destinationRoom,
}: {
  dorms: DormPin[];
  byId: Record<string, DormPin>;
  origin: Endpoint | null;
  destination: Endpoint | null;
  onOrigin: (value: Endpoint | null) => void;
  onDestination: (value: Endpoint | null) => void;
  route: Route | null;
  routing: boolean;
  destinationRoom: RoomShape | null;
}) {
  const { user } = useAuth();
  const host = destinationRoom?.hosts[0];
  return (
    <div className="space-y-3 rounded-2xl bg-paper p-3">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Room to room</p>
      <EndpointPicker label="From" value={origin} dorms={dorms} onChange={onOrigin} />
      {user?.dorm_id && user.unit && (origin?.dormId !== user.dorm_id || origin.unit !== user.unit) ? (
        <button type="button" className="text-xs text-navy underline" onClick={() => onOrigin({ dormId: user.dorm_id, unit: user.unit })}>
          Use my room ({byId[user.dorm_id]?.name} {user.unit})
        </button>
      ) : null}
      <EndpointPicker label="To" value={destination} dorms={dorms} onChange={onDestination} />
      {!destination ? <p className="text-xs text-muted">Or click a unit on the floor plan below.</p> : null}
      {routing ? <p className="text-sm text-muted">Finding the walk…</p> : null}
      {route && destination ? (
        <div className="space-y-2 text-sm">
          <p className="font-serif text-3xl text-navy">
            {route.minutes} min <span className="text-base text-muted">· {(route.meters / 1000).toFixed(1)} km</span>
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-muted">
            {route.steps.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
            ))}
          </ol>
          {route.note ? <p className="text-xs text-clay">{route.note}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {route.maps_url ? (
              <a className={btnGhost} href={route.maps_url} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            ) : null}
            {host ? (
              <Link to={`/room/${host.id}`} className={btnPrimary}>
                View {host.name.split(" ")[0]}'s couch
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EndpointPicker({
  label,
  value,
  dorms,
  onChange,
}: {
  label: string;
  value: Endpoint | null;
  dorms: DormPin[];
  onChange: (value: Endpoint | null) => void;
}) {
  const { token } = useAuth();
  const [units, setUnits] = useState<string[]>([]);
  const dormId = value?.dormId ?? "";

  useEffect(() => {
    if (!dormId) {
      setUnits([]);
      return;
    }
    api<{ dorm: DormDetail }>(`/api/dorms/${dormId}`, {}, token)
      .then((body) => setUnits(body.dorm.floors.flatMap((level) => level.rooms.map((room) => room.unit))))
      .catch(() => setUnits([]));
  }, [dormId, token]);

  return (
    <div className="text-sm">
      <span className="mb-1 block text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <select
          className="min-w-0"
          value={dormId}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next ? { dormId: next, unit: "" } : null);
          }}
        >
          <option value="">Hall</option>
          {dorms.map((dorm) => (
            <option key={dorm.id} value={dorm.id}>
              {dorm.name}
            </option>
          ))}
        </select>
        <select
          value={value?.unit ?? ""}
          disabled={!dormId}
          onChange={(event) => dormId && onChange({ dormId, unit: event.target.value })}
        >
          <option value="">Unit</option>
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

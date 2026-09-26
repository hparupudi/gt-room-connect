import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { styleLabel } from "../format";
import type { DormDetail, DormPin, MapData, RoomShape } from "../types";
import { FloorPlan } from "./FloorPlan";
import { Banner } from "./ui";

const HUB_EDGES = [
  ["west", "central"],
  ["central", "east"],
  ["east", "north"],
  ["central", "north"],
];

function yOf(value: number): number {
  return value * 0.82;
}

export function DormBrowser({
  dates,
  mode,
  pickedUnit,
  onPick,
}: {
  dates: string[];
  mode: "browse" | "pick";
  pickedUnit?: string;
  onPick?: (pick: { dormId: string; dormName: string; floor: number; unit: string }) => void;
}) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [map, setMap] = useState<MapData | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<DormDetail | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<string>("");

  useEffect(() => {
    const query = dates.length ? `?dates=${dates.join(",")}` : "";
    api<MapData>(`/api/map${query}`, {}, token)
      .then((data) => {
        setMap(data);
        setSelectedId((current) => current || data.home || data.dorms[0]?.id || "");
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "The map didn't load."));
  }, [dates, token]);

  useEffect(() => {
    if (!selectedId) return;
    const query = dates.length ? `?dates=${dates.join(",")}` : "";
    api<{ dorm: DormDetail }>(`/api/dorms/${selectedId}${query}`, {}, token)
      .then((body) => {
        setDetail(body.dorm);
        setFloor((current) => (current && body.dorm.floors.some((item) => item.floor === current) ? current : body.dorm.floors[0]?.floor ?? null));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "That hall didn't load."));
  }, [selectedId, dates, token]);

  const selected = map?.dorms.find((dorm) => dorm.id === selectedId);
  const plan = detail?.floors.find((item) => item.floor === floor) ?? null;
  const hubs = Object.fromEntries((map?.hubs ?? []).map((hub) => [hub.id, hub]));

  function chooseRoom(room: RoomShape) {
    if (!detail) return;
    if (mode === "pick") {
      onPick?.({ dormId: detail.id, dormName: detail.name, floor: floor ?? room.hosts[0]?.open_dates.length ?? detail.floors[0].floor, unit: room.unit });
      return;
    }
    const host = room.hosts[0];
    if (host) navigate(`/room/${host.id}`);
  }

  if (error) return <Banner>{error}</Banner>;
  if (!map) return <p className="text-sm text-muted">Unfolding the campus map…</p>;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm">
            <span className="sr-only">Jump to a hall</span>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-w-56">
              {map.dorms
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((dorm) => (
                  <option key={dorm.id} value={dorm.id}>
                    {dorm.name}
                    {dorm.yours ? " · your hall" : dorm.open_units ? ` · ${dorm.open_units} open` : ""}
                  </option>
                ))}
            </select>
          </label>
          <ul className="flex flex-wrap gap-3 text-xs text-muted">
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-moss" /> Open</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber" /> Request waiting</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-navy" /> Your room</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#d9d0c0]" /> Not hosting</li>
          </ul>
        </div>
        <svg viewBox="0 0 100 82" className="w-full rounded-[28px] border border-line bg-[#e7f0e4]" role="img" aria-label="Map of Georgia Tech residence halls">
          <rect x="0" y="70" width="100" height="12" fill="#e4dcc4" />
          <text x="4" y="77.5" fontSize="2.1" fill="#5c6674">North Avenue</text>
          <text x="92" y="6" fontSize="2.4" fill="#003057">N</text>
          {HUB_EDGES.map(([from, to]) => {
            const a = hubs[from];
            const b = hubs[to];
            if (!a || !b) return null;
            return (
              <line
                key={`${from}-${to}`}
                x1={a.x}
                y1={yOf(a.y)}
                x2={b.x}
                y2={yOf(b.y)}
                stroke="#ffffff"
                strokeWidth="0.7"
                strokeDasharray="1.2 0.8"
              />
            );
          })}
          {detail?.directions && detail.directions.points.length > 1 ? (
            <polyline
              fill="none"
              stroke="#8d6e2f"
              strokeWidth="0.7"
              points={detail.directions.points.map((point) => `${point.x},${yOf(point.y)}`).join(" ")}
            />
          ) : null}
          {map.landmarks.map((mark) => (
            <g key={mark.id} transform={`translate(${mark.x} ${yOf(mark.y)})`}>
              <rect x="-0.7" y="-0.7" width="1.4" height="1.4" fill="#9aa3ad" />
              <text x="1.1" y="0.45" fontSize="1.35" fill="#5c6674">
                {mark.name}
              </text>
            </g>
          ))}
          {map.dorms.map((dorm) => (
            <Pin
              key={dorm.id}
              dorm={dorm}
              active={dorm.id === selectedId}
              hovered={hover === dorm.id}
              onHover={setHover}
              onSelect={() => {
                setSelectedId(dorm.id);
                setFloor(null);
              }}
            />
          ))}
        </svg>
      </div>
      <aside className="rounded-[28px] border border-line bg-card p-4 lg:p-5">
        {detail && selected ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs tracking-[0.16em] text-gold uppercase">{styleLabel(detail.style)} · {detail.campus} campus</p>
              <h2 className="font-serif text-3xl">{detail.name}</h2>
              <p className="text-sm text-muted">{detail.address}</p>
              {detail.note ? <p className="mt-2 text-sm">{detail.note}</p> : null}
              <p className="mt-2 text-sm">
                {detail.open_units
                  ? `${detail.open_units} unit${detail.open_units === 1 ? "" : "s"} hosting on these dates.`
                  : "Nobody in this hall is hosting those nights."}
              </p>
            </div>
            {detail.directions && detail.directions.minutes > 0 ? (
              <div className="rounded-2xl bg-paper p-3 text-sm">
                <p className="font-medium">{detail.directions.minutes} min walk from your hall</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted">
                  {detail.directions.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {detail.directions.maps_url ? (
                  <a className="mt-2 inline-block text-navy underline" href={detail.directions.maps_url} target="_blank" rel="noreferrer">
                    Open walking directions
                  </a>
                ) : null}
              </div>
            ) : null}
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
            {plan ? (
              <FloorPlan
                plan={plan}
                selectedUnit={pickedUnit}
                onSelect={(room) => {
                  if (mode === "pick") {
                    onPick?.({ dormId: detail.id, dormName: detail.name, floor: plan.floor, unit: room.unit });
                  } else {
                    chooseRoom(room);
                  }
                }}
              />
            ) : null}
            <p className="text-xs text-muted">
              {mode === "pick"
                ? "Click a unit to claim it as yours. Roommates can both live in a double."
                : "Hover a unit for who's hosting. Click an open unit to see their profile."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">Choose a hall to see its floors.</p>
        )}
      </aside>
    </div>
  );
}

function Pin({
  dorm,
  active,
  hovered,
  onHover,
  onSelect,
}: {
  dorm: DormPin;
  active: boolean;
  hovered: boolean;
  onHover: (id: string) => void;
  onSelect: () => void;
}) {
  const fill = dorm.yours ? "#003057" : dorm.open_units ? "#1f6b45" : "#8d8476";
  const showLabel = active || hovered || dorm.yours;
  return (
    <g
      transform={`translate(${dorm.x} ${yOf(dorm.y)})`}
      onMouseEnter={() => onHover(dorm.id)}
      onMouseLeave={() => onHover("")}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${dorm.name}${dorm.open_units ? `, ${dorm.open_units} open` : ""}`}
      className="cursor-pointer"
    >
      <circle r={active ? 2.15 : 1.55} fill={fill} stroke={active ? "#e7d7a8" : "white"} strokeWidth={active ? 0.45 : 0.25} />
      {showLabel ? (
        <text y="-2.5" textAnchor="middle" fontSize="1.7" fill="#1c2430">
          {dorm.code}
        </text>
      ) : null}
    </g>
  );
}

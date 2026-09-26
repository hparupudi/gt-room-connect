import { useState } from "react";

import { formatDates, sleepLabel } from "../format";
import type { FloorPlan as Floor, RoomShape } from "../types";

const FILL: Record<RoomShape["status"], string> = {
  open: "#1f6b45",
  pending: "#8a5a12",
  yours: "#003057",
  idle: "#efe8da",
};

export function FloorPlan({
  plan,
  selectedUnit,
  onSelect,
}: {
  plan: Floor;
  selectedUnit?: string;
  onSelect?: (room: RoomShape) => void;
}) {
  const [hover, setHover] = useState<{ room: RoomShape; x: number; y: number } | null>(null);
  const [vbX, vbY, vbW, vbH] = plan.viewBox;

  return (
    <div className="relative">
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full rounded-2xl border border-line bg-[#f7f3ea]"
        role="img"
        aria-label={`Floor ${plan.floor} layout`}
      >
        {plan.hall ? (
          <g>
            <rect x={plan.hall.x} y={plan.hall.y} width={plan.hall.w} height={plan.hall.h} rx="8" fill="#e7e1d4" />
            {plan.hall.label ? (
              <text
                x={plan.hall.x + plan.hall.w / 2}
                y={plan.hall.y + plan.hall.h / 2 + 5}
                textAnchor="middle"
                fontSize="20"
                fill="#5c6674"
              >
                {plan.hall.label}
              </text>
            ) : null}
          </g>
        ) : null}
        {plan.fixtures.map((fixture) => (
          <g key={`${fixture.label}-${fixture.x}-${fixture.y}`}>
            <rect
              x={fixture.x}
              y={fixture.y}
              width={fixture.w}
              height={fixture.h}
              rx="6"
              fill="none"
              stroke="#c9bfae"
              strokeDasharray="4 3"
            />
            <text x={fixture.x + fixture.w / 2} y={fixture.y + fixture.h / 2 + 4} textAnchor="middle" fontSize="16" fill="#5c6674">
              {fixture.label}
            </text>
          </g>
        ))}
        {plan.rooms.map((room) => {
          const selected = selectedUnit === room.unit;
          const ink = room.status === "idle" ? "#1c2430" : "#fffaf3";
          return (
            <g
              key={room.unit}
              onMouseEnter={(event) => setHover({ room, x: event.clientX, y: event.clientY })}
              onMouseMove={(event) => setHover({ room, x: event.clientX, y: event.clientY })}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(room)}
              className="cursor-pointer"
            >
              <rect
                x={room.x}
                y={room.y}
                width={room.w}
                height={room.h}
                rx="10"
                fill={FILL[room.status]}
                stroke={selected ? "#8d6e2f" : "#d9d0c0"}
                strokeWidth={selected ? 4 : 1}
              />
              {room.kind === "apartment" ? (
                <line
                  x1={room.x + room.w * 0.42}
                  y1={room.y + 10}
                  x2={room.x + room.w * 0.42}
                  y2={room.y + room.h - 10}
                  stroke={ink}
                  strokeOpacity="0.35"
                />
              ) : null}
              <text x={room.x + 14} y={room.y + 32} fontSize="22" fontWeight="600" fill={ink}>
                {room.unit}
              </text>
              <text x={room.x + 14} y={room.y + 54} fontSize="14" fill={ink} opacity="0.85">
                {room.status === "open"
                  ? "Open"
                  : room.status === "pending"
                    ? "Request in"
                    : room.status === "yours"
                      ? "Your room"
                      : room.kind === "apartment"
                        ? "Bed  ·  living"
                        : "Not hosting"}
              </text>
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div
          className="pointer-events-none fixed z-30 w-56 rounded-2xl border border-line bg-card p-3 text-sm shadow-lg"
          style={{ left: Math.min(hover.x + 12, window.innerWidth - 240), top: hover.y + 12 }}
        >
          <p className="font-medium">Unit {hover.room.unit}</p>
          {hover.room.hosts.length ? (
            <ul className="mt-1 space-y-1 text-muted">
              {hover.room.hosts.map((host) => (
                <li key={host.id}>
                  {host.name}
                  {host.sleep_timing ? ` · ${sleepLabel(host.sleep_timing).toLowerCase()}` : ""}
                  {host.cleanliness ? ` · ${host.cleanliness}` : ""}
                  <span className="block text-ink">{formatDates(host.open_dates)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted">Nobody is offering this unit right now.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

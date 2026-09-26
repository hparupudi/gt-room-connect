import { useEffect, useId, useRef, useState } from "react";

import { FRAME_CLEARANCE, elevationHeight, fmt, framePlan, measuresOf, type Setup } from "../roomPlan";
import type { HousingFacts, RoomFootprint } from "../types";

const SETUPS: { id: Setup; label: string; note: string }[] = [
  { id: "low", label: "Low", note: "Low puts the frame 8 in off the floor." },
  { id: "mid", label: "Medium", note: "Medium is about 3 ft off the floor, with the dresser under the bed." },
  { id: "high", label: "High", note: "High is about 6 ft off the floor, with the dresser and desk under the bed." },
  { id: "bunked", label: "Bunked", note: "Bunked stacks one frame at 8 in and one at about 6 ft." },
];

const BED = "#e7d7a8";
const DESK = "#fffaf3";
const DRESSER = "#f3e2c4";
const WARDROBE = "#efe6d4";

const FALLBACK_ROOM: RoomFootprint = {
  width_in: 180,
  depth_in: 132,
  width_label: "15'",
  depth_label: "11'",
  summary: "approximately 12' × 10' to 15' × 11'",
  drawing: "15' × 11'",
  range: true,
  approximate: true,
  occupants: 2,
  source: "https://housing.gatech.edu/first-time-residents/faq",
  note: "East Campus traditional rooms are approximately 12' × 10' to 15' × 11'. This drawing is the larger end, 15' × 11'. Bed, desk, chair, dresser, and wardrobe are the inch sizes Housing publishes.",
};

function PieceShape({ item, fade }: { item: ReturnType<typeof framePlan>["pieces"][number]; fade?: boolean }) {
  const wide = item.w > item.h;
  const pillow = wide ? Math.min(14, item.w * 0.18) : Math.min(12, item.h * 0.16);
  return (
    <g>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        rx={1.2}
        fill={item.fill}
        fillOpacity={fade ? 0.42 : 1}
        stroke="#003057"
        strokeWidth={0.6}
        strokeDasharray={item.under ? "1.8 1.1" : undefined}
      />
      {item.pillow && !wide ? (
        <rect x={item.x + 1.6} y={item.y + 1.6} width={item.w - 3.2} height={pillow} rx={1} fill="#fffaf3" stroke="#003057" strokeWidth={0.35} />
      ) : null}
      {item.pillow && wide ? (
        <rect x={item.x + 1.6} y={item.y + 1.6} width={pillow} height={item.h - 3.2} rx={1} fill="#fffaf3" stroke="#003057" strokeWidth={0.35} />
      ) : null}
      {item.bunk ? (
        wide ? (
          <line x1={item.x + item.w / 2} y1={item.y + 1.4} x2={item.x + item.w / 2} y2={item.y + item.h - 1.4} stroke="#003057" strokeWidth={0.45} />
        ) : (
          <line x1={item.x + 1.4} y1={item.y + item.h / 2} x2={item.x + item.w - 1.4} y2={item.y + item.h / 2} stroke="#003057" strokeWidth={0.45} />
        )
      ) : null}
    </g>
  );
}

function PieceLabel({ item }: { item: ReturnType<typeof framePlan>["pieces"][number] }) {
  if (item.pillow || Math.min(item.w, item.h) < 18) return null;
  return (
    <text x={item.x + item.w / 2} y={item.y + item.h / 2 + 1.2} textAnchor="middle" fontSize={4} fontWeight={600} fill="#003057">
      {item.title}
    </text>
  );
}

function SideView({ x, y, setup, measures }: { x: number; y: number; setup: Setup; measures: ReturnType<typeof measuresOf> }) {
  const floor = y + elevationHeight(measures) - 8;
  const bedLen = measures.bed.d;
  const mattress = 4;
  const frame = setup === "high" ? FRAME_CLEARANCE.high : setup === "mid" ? FRAME_CLEARANCE.mid : FRAME_CLEARANCE.low;
  const bedX = x;
  const at = (clearance: number) => floor - clearance - mattress;
  let cursor = bedX + bedLen + 6;
  const deskBeside = setup !== "high";
  const deskX = cursor;
  if (deskBeside) cursor += measures.desk.w + 6;
  const wardX = cursor;
  const frameLabel = setup === "mid" ? "about 3 ft" : setup === "high" ? "about 6 ft" : "8 in";
  return (
    <g>
      <text x={x} y={y + 5} fontSize={8} fill="#8d6e2f">
        Side
      </text>
      <line x1={x} y1={floor} x2={x + wardX + measures.wardrobe.w} y2={floor} stroke="#003057" strokeWidth={0.8} />
      {setup === "mid" || setup === "high" ? (
        <rect x={bedX + 4} y={floor - measures.dresser.h} width={measures.dresser.w} height={measures.dresser.h} fill={DRESSER} stroke="#003057" strokeWidth={0.45} />
      ) : null}
      {setup === "high" ? (
        <rect
          x={bedX + measures.dresser.w + 8}
          y={floor - measures.desk.h}
          width={measures.desk.w}
          height={measures.desk.h}
          fill={DESK}
          stroke="#003057"
          strokeWidth={0.45}
        />
      ) : null}
      <rect x={bedX} y={at(frame)} width={bedLen} height={mattress} fill={BED} stroke="#003057" strokeWidth={0.45} />
      <line x1={bedX + 1.2} y1={floor} x2={bedX + 1.2} y2={at(frame)} stroke="#003057" strokeWidth={0.7} />
      <line x1={bedX + bedLen - 1.2} y1={floor} x2={bedX + bedLen - 1.2} y2={at(frame)} stroke="#003057" strokeWidth={0.7} />
      {setup === "bunked" ? (
        <g>
          <rect x={bedX} y={at(FRAME_CLEARANCE.high)} width={bedLen} height={mattress} fill={BED} stroke="#003057" strokeWidth={0.45} />
          <line x1={bedX + 1.2} y1={floor} x2={bedX + 1.2} y2={at(FRAME_CLEARANCE.high)} stroke="#003057" strokeWidth={0.7} />
          <line x1={bedX + bedLen - 1.2} y1={floor} x2={bedX + bedLen - 1.2} y2={at(FRAME_CLEARANCE.high)} stroke="#003057" strokeWidth={0.7} />
        </g>
      ) : null}
      <text
        x={setup === "high" ? bedX + bedLen - 2 : bedX + 2}
        y={setup === "high" ? at(frame) + mattress + 8 : at(frame) - 2}
        textAnchor={setup === "high" ? "end" : "start"}
        fontSize={3.6}
        fill="#5c6674"
      >
        {frameLabel}
      </text>
      {setup === "bunked" ? (
        <text x={bedX + 2} y={at(FRAME_CLEARANCE.high) - 2} fontSize={3.6} fill="#5c6674">
          about 6 ft
        </text>
      ) : null}
      {deskBeside ? (
        <g>
          <rect x={deskX} y={floor - measures.desk.h} width={measures.desk.w} height={measures.desk.h} fill={DESK} stroke="#003057" strokeWidth={0.45} />
          <text x={deskX + measures.desk.w / 2} y={floor - measures.desk.h / 2} textAnchor="middle" fontSize={3.4} fill="#003057">
            Desk {fmt(measures.desk.h)} in
          </text>
        </g>
      ) : (
        <text x={bedX + measures.dresser.w + 10} y={floor - 4} fontSize={3.2} fill="#5c6674">
          Desk {fmt(measures.desk.h)} in
        </text>
      )}
      <rect x={wardX} y={floor - measures.wardrobe.h} width={measures.wardrobe.w} height={measures.wardrobe.h} fill={WARDROBE} stroke="#003057" strokeWidth={0.45} />
      <text x={wardX + measures.wardrobe.w / 2} y={floor - measures.wardrobe.h / 2} textAnchor="middle" fontSize={3.4} fill="#003057">
        {fmt(measures.wardrobe.h)} in
      </text>
    </g>
  );
}

function Dimension({ x1, y1, x2, y2, label, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <g stroke="#8d6e2f" fill="#8d6e2f">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={0.7} />
      {vertical ? (
        <g>
          <line x1={x1 - 3} y1={y1} x2={x1 + 3} y2={y1} strokeWidth={0.7} />
          <line x1={x2 - 3} y1={y2} x2={x2 + 3} y2={y2} strokeWidth={0.7} />
          <text x={midX - 6} y={midY} textAnchor="middle" fontSize={8} transform={`rotate(-90 ${midX - 6} ${midY})`} stroke="none">
            {label}
          </text>
        </g>
      ) : (
        <g>
          <line x1={x1} y1={y1 - 3} x2={x1} y2={y1 + 3} strokeWidth={0.7} />
          <line x1={x2} y1={y2 - 3} x2={x2} y2={y2 + 3} strokeWidth={0.7} />
          <text x={midX} y={midY - 4} textAnchor="middle" fontSize={8} stroke="none">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

export function RoomLayoutDialog({
  hallName,
  unit,
  floor,
  roomStyle,
  housing,
  onClose,
}: {
  hallName: string;
  unit: string;
  floor: number | null;
  roomStyle: string;
  housing?: HousingFacts | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [setup, setSetup] = useState<Setup>("low");
  const measures = measuresOf(housing?.dimensions);
  const foot = housing?.room ?? FALLBACK_ROOM;
  const plan = framePlan(foot, setup, measures);
  const styleLine = [hallName, floor == null ? "" : `floor ${floor}`, roomStyle].filter(Boolean).join(" · ");
  const setupNote = SETUPS.find((item) => item.id === setup)?.note ?? "";

  useEffect(() => {
    setSetup("low");
  }, [unit, hallName, floor]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const room = plan.room;
  const doorTop = plan.door.wall === "left" ? plan.door.y : room.y + room.h - 8;
  const doorBot = plan.door.wall === "left" ? plan.door.y + plan.door.length : room.y + room.h;
  const wall =
    plan.door.wall === "left"
      ? `M ${room.x} ${doorTop} V ${room.y} H ${room.x + room.w} V ${room.y + room.h} H ${room.x} V ${doorBot}`
      : `M ${room.x} ${room.y} H ${room.x + room.w} V ${room.y + room.h} H ${plan.door.x + plan.door.length} M ${plan.door.x} ${room.y + room.h} H ${room.x} Z`;
  const beds = plan.pieces.filter((item) => item.key.startsWith("bed"));
  const under = plan.pieces.filter((item) => item.under);
  const floorPieces = plan.pieces.filter((item) => !item.under && !item.key.startsWith("bed"));
  const legend = [
    { name: "Bed", fill: BED, text: `${fmt(measures.bed.w)} × ${fmt(measures.bed.d)} in, Twin XL` },
    { name: "Desk", fill: DESK, text: `${fmt(measures.desk.w)} × ${fmt(measures.desk.d)} in, ${fmt(measures.desk.h)} in high` },
    { name: "Chair", fill: "#d7efe3", text: `${fmt(measures.chair.w)} × ${fmt(measures.chair.d)} in, ${fmt(measures.chair.h)} in high` },
    { name: "Dresser", fill: DRESSER, text: `${fmt(measures.dresser.w)} × ${fmt(measures.dresser.d)} in, ${fmt(measures.dresser.h)} in high` },
    { name: "Wardrobe", fill: WARDROBE, text: `${fmt(measures.wardrobe.w)} × ${fmt(measures.wardrobe.d)} in, ${fmt(measures.wardrobe.h)} in high` },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-room-size={foot.drawing}
        data-room-width={foot.width_in}
        data-room-depth={foot.depth_in}
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-line bg-card p-5 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-gold uppercase">Room layout</p>
            <h2 id={titleId} className="font-serif text-4xl text-navy">
              Room {unit}
            </h2>
            <p className="font-serif text-3xl text-navy">{foot.drawing}</p>
            {foot.summary !== foot.drawing ? <p className="text-sm text-ink">{foot.summary}</p> : null}
            <p className="text-sm text-muted">{styleLine}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-xl leading-none"
            aria-label="Close room layout"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Bed setup">
          {SETUPS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={setup === item.id}
              onClick={() => setSetup(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${setup === item.id ? "bg-navy text-paper" : "bg-paper text-ink"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{setupNote}</p>
        <svg
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          className="mt-3 w-full rounded-2xl border border-line bg-[#f7f3ea]"
          role="img"
          aria-label={`${roomStyle || "Room"} ${unit}, ${foot.drawing}. ${SETUPS.find((item) => item.id === setup)?.label} bed. Twin XL ${fmt(measures.bed.w)} by ${fmt(measures.bed.d)} inches, desk ${fmt(measures.desk.w)} by ${fmt(measures.desk.d)} inches, inside a ${foot.width_label} by ${foot.depth_label} room.`}
        >
          <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="#fbf7f0" />
          <Dimension x1={room.x} y1={room.y - 12} x2={room.x + room.w} y2={room.y - 12} label={foot.width_label} />
          <Dimension x1={room.x - 14} y1={room.y} x2={room.x - 14} y2={room.y + room.h} label={foot.depth_label} vertical />
          <g>
            {under.map((item) => (
              <PieceShape key={item.key} item={item} />
            ))}
            {beds.map((item) => (
              <PieceShape key={item.key} item={item} fade={under.length > 0} />
            ))}
            {floorPieces.map((item) => (
              <PieceShape key={item.key} item={item} />
            ))}
            {[...under, ...floorPieces].map((item) => (
              <PieceLabel key={`${item.key}-label`} item={item} />
            ))}
          </g>
          <path d={wall} fill="none" stroke="#003057" strokeWidth={1.4} />
          {plan.door.wall === "left" ? (
            <path
              d={`M ${room.x} ${doorBot} A ${plan.door.length} ${plan.door.length} 0 0 1 ${room.x + plan.door.length} ${doorTop}`}
              fill="none"
              stroke="#003057"
              strokeWidth={0.45}
            />
          ) : (
            <path
              d={`M ${plan.door.x} ${room.y + room.h} A ${plan.door.length} ${plan.door.length} 0 0 1 ${plan.door.x + plan.door.length} ${room.y + room.h - plan.door.length}`}
              fill="none"
              stroke="#003057"
              strokeWidth={0.45}
            />
          )}
          <SideView x={plan.elevX} y={plan.elevY} setup={setup} measures={measures} />
        </svg>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {legend.map((item) => (
            <li key={item.name} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border border-navy" style={{ background: item.fill }} />
              <span>
                {item.name} {item.text}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">{foot.note}</p>
        <p className="mt-1 text-xs text-muted">
          <a className="underline" href={foot.source}>
            Room sizes
          </a>
          {" · "}
          <a className="underline" href={housing?.dimensions_source || "https://housing.gatech.edu/room-and-furniture"}>
            Furniture sizes
          </a>
        </p>
      </div>
    </div>
  );
}

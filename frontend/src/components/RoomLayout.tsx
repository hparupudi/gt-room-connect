import { useEffect, useId, useRef, useState } from "react";

import type { HousingFacts } from "../types";

type Setup = "low" | "mid" | "high" | "bunked";

type Piece = { w: number; d: number };

type Measures = {
  bed: Piece;
  wardrobe: Piece;
  desk: Piece;
  chair: Piece;
  dresser: Piece;
};

type Drawn = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  detail: string;
  fill: string;
  pillow?: boolean;
  bunk?: boolean;
  under?: boolean;
};

const SETUPS: { id: Setup; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "mid", label: "Mid loft" },
  { id: "high", label: "High loft" },
  { id: "bunked", label: "Bunked" },
];

const BED = "#e7d7a8";
const DESK = "#fffaf3";
const CHAIR = "#d7efe3";
const WARDROBE = "#efe6d4";
const DRESSER = "#f3e2c4";
const BATH = "#d5e4f2";
const LIVING = "#e7efe4";

function inches(lines: string[] | undefined, key: string, fallback: number): number {
  const line = (lines || []).find((item) => item.toLowerCase().startsWith(key));
  const match = line?.match(/([\d.]+)/);
  const value = match ? Number(match[1]) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function measuresOf(housing: HousingFacts | null | undefined): Measures {
  const byName = Object.fromEntries((housing?.dimensions || []).map((item) => [item.name, item.lines || []]));
  return {
    bed: { w: inches(byName.Bed, "width", 38), d: inches(byName.Bed, "length", 85.5) },
    wardrobe: { w: inches(byName.Wardrobe, "width", 36), d: inches(byName.Wardrobe, "depth", 24) },
    desk: { w: inches(byName.Desk, "width", 42), d: inches(byName.Desk, "depth", 24) },
    chair: { w: inches(byName.Chair, "width", 20), d: inches(byName.Chair, "depth", 23) },
    dresser: { w: inches(byName["Dresser/Chest"], "width", 30), d: inches(byName["Dresser/Chest"], "depth", 24) },
  };
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function sizeLabel(piece: Piece): string {
  return `${fmt(piece.w)} × ${fmt(piece.d)} in`;
}

function layoutKind(roomStyle: string): "double" | "suite" | "apartment" {
  const value = roomStyle.toLowerCase();
  if (value.includes("apartment")) return "apartment";
  if (value.includes("suite")) return "suite";
  return "double";
}

function bedTitle(setup: Setup): string {
  if (setup === "bunked") return "Bunks";
  if (setup === "mid") return "Mid loft";
  if (setup === "high") return "High loft";
  return "Bed";
}

const GAP = 8;

function columnWidth(measures: Measures): number {
  return Math.max(measures.bed.w, measures.desk.w, measures.wardrobe.w, measures.dresser.w);
}

function residentColumn(measures: Measures, x: number, y: number, setup: Setup, suffix: string): Drawn[] {
  const width = columnWidth(measures);
  const center = (piece: number) => x + (width - piece) / 2;
  const items: Drawn[] = [];
  let cursor = y;
  const push = (item: Omit<Drawn, "x" | "y"> & { x: number; y: number }) => items.push(item);

  push({
    key: `wardrobe-${suffix}`,
    x: center(measures.wardrobe.w),
    y: cursor,
    w: measures.wardrobe.w,
    h: measures.wardrobe.d,
    title: "Wardrobe",
    detail: sizeLabel(measures.wardrobe),
    fill: WARDROBE,
  });
  cursor += measures.wardrobe.d + GAP;
  push({
    key: `dresser-${suffix}`,
    x: center(measures.dresser.w),
    y: cursor,
    w: measures.dresser.w,
    h: measures.dresser.d,
    title: "Dresser",
    detail: sizeLabel(measures.dresser),
    fill: DRESSER,
  });
  cursor += measures.dresser.d + GAP;
  const bedX = center(measures.bed.w);
  const bedY = cursor;
  push({
    key: `bed-${suffix}`,
    x: bedX,
    y: bedY,
    w: measures.bed.w,
    h: measures.bed.d,
    title: bedTitle(setup),
    detail: sizeLabel(measures.bed),
    fill: BED,
    pillow: true,
    bunk: setup === "bunked",
  });
  cursor += measures.bed.d + GAP;
  if (setup === "low" || setup === "bunked") {
    push({
      key: `desk-${suffix}`,
      x: center(measures.desk.w),
      y: cursor,
      w: measures.desk.w,
      h: measures.desk.d,
      title: "Desk",
      detail: sizeLabel(measures.desk),
      fill: DESK,
    });
    cursor += measures.desk.d + 5;
    push({
      key: `chair-${suffix}`,
      x: center(measures.chair.w),
      y: cursor,
      w: measures.chair.w,
      h: measures.chair.d,
      title: "Chair",
      detail: sizeLabel(measures.chair),
      fill: CHAIR,
    });
  } else {
    push({
      key: `desk-${suffix}`,
      x: bedX + (measures.bed.w - measures.desk.w) / 2,
      y: bedY + measures.bed.d - measures.desk.d - 3,
      w: measures.desk.w,
      h: measures.desk.d,
      title: "Desk",
      detail: sizeLabel(measures.desk),
      fill: DESK,
      under: true,
    });
    push({
      key: `chair-${suffix}`,
      x: center(measures.chair.w),
      y: cursor,
      w: measures.chair.w,
      h: measures.chair.d,
      title: "Chair",
      detail: sizeLabel(measures.chair),
      fill: CHAIR,
    });
  }
  return items;
}

function bunkedDouble(measures: Measures): Drawn[] {
  const pieces: { key: string; title: string; piece: Piece; fill: string }[] = [
    { key: "wardrobe-a", title: "Wardrobe", piece: measures.wardrobe, fill: WARDROBE },
    { key: "dresser-a", title: "Dresser", piece: measures.dresser, fill: DRESSER },
    { key: "wardrobe-b", title: "Wardrobe", piece: measures.wardrobe, fill: WARDROBE },
    { key: "dresser-b", title: "Dresser", piece: measures.dresser, fill: DRESSER },
  ];
  const items: Drawn[] = [];
  let x = 0;
  for (const piece of pieces) {
    items.push({
      key: piece.key,
      x,
      y: 0,
      w: piece.piece.w,
      h: piece.piece.d,
      title: piece.title,
      detail: sizeLabel(piece.piece),
      fill: piece.fill,
    });
    x += piece.piece.w + GAP;
  }
  const total = x - GAP;
  const bedY = measures.wardrobe.d + GAP;
  items.push({
    key: "bed-a",
    x: (total - measures.bed.w) / 2,
    y: bedY,
    w: measures.bed.w,
    h: measures.bed.d,
    title: "Bunks",
    detail: sizeLabel(measures.bed),
    fill: BED,
    pillow: true,
    bunk: true,
  });
  const deskY = bedY + measures.bed.d + GAP;
  items.push({
    key: "desk-a",
    x: 0,
    y: deskY,
    w: measures.desk.w,
    h: measures.desk.d,
    title: "Desk",
    detail: sizeLabel(measures.desk),
    fill: DESK,
  });
  items.push({
    key: "chair-a",
    x: (measures.desk.w - measures.chair.w) / 2,
    y: deskY + measures.desk.d + 5,
    w: measures.chair.w,
    h: measures.chair.d,
    title: "Chair",
    detail: sizeLabel(measures.chair),
    fill: CHAIR,
  });
  const right = total - measures.desk.w;
  items.push({
    key: "desk-b",
    x: right,
    y: deskY,
    w: measures.desk.w,
    h: measures.desk.d,
    title: "Desk",
    detail: sizeLabel(measures.desk),
    fill: DESK,
  });
  items.push({
    key: "chair-b",
    x: right + (measures.desk.w - measures.chair.w) / 2,
    y: deskY + measures.desk.d + 5,
    w: measures.chair.w,
    h: measures.chair.d,
    title: "Chair",
    detail: sizeLabel(measures.chair),
    fill: CHAIR,
  });
  return items;
}

function furniture(measures: Measures, kind: "double" | "suite" | "apartment", setup: Setup): Drawn[] {
  if (kind === "apartment") {
    const items = residentColumn(measures, 0, 0, setup === "bunked" ? "low" : setup, "a");
    if (setup === "bunked") {
      const bed = items.find((item) => item.key.startsWith("bed"));
      if (bed) {
        bed.title = "Bunks";
        bed.bunk = true;
      }
    }
    const livingX = columnWidth(measures) + 40;
    items.push(
      { key: "sofa", x: livingX, y: 0, w: 62, h: 28, title: "Sofa", detail: "", fill: LIVING },
      { key: "dining", x: livingX, y: 40, w: 48, h: 30, title: "Dining table", detail: "", fill: DESK },
      { key: "kitchen", x: livingX, y: 82, w: 62, h: 24, title: "Kitchen", detail: "", fill: DRESSER },
    );
    return items;
  }
  const items = setup === "bunked" ? bunkedDouble(measures) : [
    ...residentColumn(measures, 0, 0, setup, "a"),
    ...residentColumn(measures, columnWidth(measures) + 34, 0, setup, "b"),
  ];
  if (kind === "suite") {
    const maxX = Math.max(...items.map((item) => item.x + item.w));
    const maxY = Math.max(...items.map((item) => item.y + item.h));
    items.push({
      key: "bath",
      x: maxX + 16,
      y: 0,
      w: 54,
      h: Math.min(96, maxY),
      title: "Shared bath",
      detail: "",
      fill: BATH,
    });
  }
  return items;
}

function framed(items: Drawn[]) {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.w));
  const maxY = Math.max(...items.map((item) => item.y + item.h));
  const left = 16;
  const top = 16;
  const pad = 14;
  const shiftX = left + pad - minX;
  const shiftY = top + pad - minY;
  const moved = items.map((item) => ({ ...item, x: item.x + shiftX, y: item.y + shiftY }));
  const room = { x: left, y: top, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  const elevX = room.x + room.w + 12;
  const elevY = room.y;
  const elevW = 86;
  const elevH = Math.min(78, room.h);
  return {
    items: moved,
    room,
    elevX,
    elevY,
    elevW,
    elevH,
    width: elevX + elevW + 8,
    height: room.y + room.h + 10,
  };
}

function Furniture({ item }: { item: Drawn }) {
  const pillowH = Math.min(12, item.h * 0.16);
  const titleY = item.pillow ? item.y + pillowH + 7 : item.y + item.h / 2 - (item.detail ? 1.6 : 0);
  const bath = item.key === "bath";
  return (
    <g>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        rx={1.4}
        fill={item.fill}
        stroke="#003057"
        strokeWidth={bath ? 1.1 : 0.55}
        strokeDasharray={item.under ? "1.4 0.9" : undefined}
      />
      {item.pillow ? (
        <rect x={item.x + 1.6} y={item.y + 1.6} width={item.w - 3.2} height={pillowH} rx={1} fill="#fffaf3" stroke="#003057" strokeWidth={0.35} />
      ) : null}
      {item.bunk ? <line x1={item.x + 1.4} y1={item.y + item.h / 2} x2={item.x + item.w - 1.4} y2={item.y + item.h / 2} stroke="#003057" strokeWidth={0.45} /> : null}
      {item.key.startsWith("dresser") ? (
        <g stroke="#003057" strokeOpacity={0.35} strokeWidth={0.35}>
          <line x1={item.x + 1.5} y1={item.y + item.h / 3} x2={item.x + item.w - 1.5} y2={item.y + item.h / 3} />
          <line x1={item.x + 1.5} y1={item.y + (2 * item.h) / 3} x2={item.x + item.w - 1.5} y2={item.y + (2 * item.h) / 3} />
        </g>
      ) : null}
      {bath ? (
        <g fill="none" stroke="#003057" strokeWidth={0.45}>
          <ellipse cx={item.x + item.w / 2} cy={item.y + 28} rx={12} ry={7} />
          <circle cx={item.x + item.w / 2} cy={item.y + item.h - 16} r={4} />
        </g>
      ) : null}
      <text x={item.x + item.w / 2} y={bath ? item.y + 10 : titleY} textAnchor="middle" fontSize={bath ? 3.2 : 3.5} fontWeight={600} fill="#003057">
        {item.title}
      </text>
      {item.detail ? (
        <text x={item.x + item.w / 2} y={titleY + 4.2} textAnchor="middle" fontSize={2.7} fill="#5c6674">
          {item.detail}
        </text>
      ) : null}
    </g>
  );
}

function SideView({ x, y, w, h, setup }: { x: number; y: number; w: number; h: number; setup: Setup }) {
  const floor = y + h - 8;
  const bedW = Math.min(52, w * 0.28);
  const bedX = x + 10;
  const thick = 5;
  const lift = setup === "high" ? h * 0.46 : setup === "mid" ? h * 0.28 : setup === "bunked" ? h * 0.34 : 2;
  const bedY = floor - thick - lift;
  return (
    <g>
      <text x={x} y={y + 4} fontSize={3} fill="#8d6e2f" letterSpacing={0.6}>
        SIDE
      </text>
      <line x1={x} y1={floor} x2={x + w} y2={floor} stroke="#003057" strokeWidth={0.7} />
      {setup === "mid" || setup === "high" ? (
        <rect x={bedX + 6} y={bedY + thick + 1} width={Math.max(bedW - 14, 12)} height={Math.max(lift - 2, 4)} fill={DESK} stroke="#003057" strokeWidth={0.35} />
      ) : null}
      {setup === "high" ? (
        <rect x={bedX + bedW + 6} y={floor - 14} width={14} height={14} fill={DRESSER} stroke="#003057" strokeWidth={0.35} />
      ) : null}
      <rect x={bedX} y={bedY} width={bedW} height={thick} rx={0.5} fill={BED} stroke="#003057" strokeWidth={0.4} />
      {setup === "bunked" ? <rect x={bedX} y={bedY - 12} width={bedW} height={thick} rx={0.5} fill={BED} stroke="#003057" strokeWidth={0.4} /> : null}
      <text x={bedX + bedW + 6} y={bedY + 3.2} fontSize={3} fill="#5c6674">
        Twin XL
      </text>
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
  const measures = measuresOf(housing);
  const kind = layoutKind(roomStyle);
  const plan = framed(furniture(measures, kind, setup));
  const styleLine = [hallName, floor == null ? "" : `floor ${floor}`, roomStyle].filter(Boolean).join(" · ");

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

  const door = 26;
  const doorX = plan.room.x + (plan.room.w - door) / 2;
  const bottom = plan.room.y + plan.room.h;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-line bg-card p-5 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-gold uppercase">Room layout</p>
            <h2 id={titleId} className="font-serif text-4xl text-navy">
              Room {unit}
            </h2>
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
        <svg
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          className="mt-4 w-full rounded-2xl border border-line bg-[#f7f3ea]"
          role="img"
          aria-label={`${roomStyle || "Room"} ${unit}. ${SETUPS.find((item) => item.id === setup)?.label} bed, Twin XL ${fmt(measures.bed.w)} by ${fmt(measures.bed.d)} inches, with wardrobe, desk, chair, and dresser.`}
        >
          <rect x={plan.room.x} y={plan.room.y} width={plan.room.w} height={plan.room.h} fill="#fbf7f0" />
          <text x={plan.room.x} y={plan.room.y - 4} fontSize={3} fill="#8d6e2f" letterSpacing={0.6}>
            PLAN
          </text>
          <g>
            {plan.items.map((item) => (
              <Furniture key={item.key} item={item} />
            ))}
          </g>
          <path
            d={`M ${plan.room.x} ${plan.room.y} H ${plan.room.x + plan.room.w} V ${bottom} H ${doorX + door} M ${doorX} ${bottom} H ${plan.room.x} Z`}
            fill="none"
            stroke="#003057"
            strokeWidth={1.3}
          />
          <path
            d={`M ${doorX} ${bottom} A ${door} ${door} 0 0 1 ${doorX + door} ${bottom - door}`}
            fill="none"
            stroke="#003057"
            strokeWidth={0.45}
          />
          <g stroke="#8d6e2f" strokeWidth={0.45}>
            <line x1={plan.room.x + 10} y1={plan.room.y + 3.5} x2={plan.room.x + plan.room.w - 10} y2={plan.room.y + 3.5} />
            <line x1={plan.room.x + 10} y1={plan.room.y + 5.4} x2={plan.room.x + plan.room.w - 10} y2={plan.room.y + 5.4} strokeWidth={0.25} />
          </g>
          <SideView x={plan.elevX} y={plan.elevY} w={plan.elevW} h={plan.elevH} setup={setup} />
        </svg>
        <p className="mt-2 text-xs text-muted">Drawn to the furniture sizes Housing publishes.</p>
      </div>
    </div>
  );
}

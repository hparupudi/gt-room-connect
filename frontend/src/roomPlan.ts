import type { RoomFootprint } from "./types";

export type Setup = "low" | "mid" | "high" | "bunked";

export type Piece = { w: number; d: number; h: number };

export type Measures = {
  bed: Piece;
  wardrobe: Piece;
  desk: Piece;
  chair: Piece;
  dresser: Piece;
};

export type Drawn = {
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

export type Door = { wall: "left" | "bottom"; x: number; y: number; length: number; swing: number };

export type RoomPlan = {
  pieces: Drawn[];
  door: Door;
  room: { x: number; y: number; w: number; h: number };
  elevX: number;
  elevY: number;
  elevW: number;
  elevH: number;
  width: number;
  height: number;
};

const BED = "#e7d7a8";
const DESK = "#fffaf3";
const CHAIR = "#d7efe3";
const WARDROBE = "#efe6d4";
const DRESSER = "#f3e2c4";

export const FRAME_CLEARANCE = { low: 8, mid: 36, high: 72 } as const;

function inches(lines: string[] | undefined, key: string, fallback: number): number {
  const line = (lines || []).find((item) => item.toLowerCase().startsWith(key));
  const match = line?.match(/([\d.]+)/);
  const value = match ? Number(match[1]) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function measuresOf(dimensions: { name: string; lines?: string[] }[] | undefined): Measures {
  const byName = Object.fromEntries((dimensions || []).map((item) => [item.name, item.lines || []]));
  return {
    bed: { w: inches(byName.Bed, "width", 38), d: inches(byName.Bed, "length", 85.5), h: 0 },
    wardrobe: { w: inches(byName.Wardrobe, "width", 36), d: inches(byName.Wardrobe, "depth", 24), h: inches(byName.Wardrobe, "height", 76) },
    desk: { w: inches(byName.Desk, "width", 42), d: inches(byName.Desk, "depth", 24), h: inches(byName.Desk, "height", 30) },
    chair: { w: inches(byName.Chair, "width", 20), d: inches(byName.Chair, "depth", 23), h: inches(byName.Chair, "height", 33) },
    dresser: {
      w: inches(byName["Dresser/Chest"], "width", 30),
      d: inches(byName["Dresser/Chest"], "depth", 24),
      h: inches(byName["Dresser/Chest"], "height", 30),
    },
  };
}

export function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function sizeLabel(piece: Piece): string {
  return `${fmt(piece.w)} × ${fmt(piece.d)} in`;
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w - 0.05 && a.x + a.w > b.x + 0.05 && a.y < b.y + b.h - 0.05 && a.y + a.h > b.y + 0.05;
}

function inside(roomW: number, roomD: number, item: { x: number; y: number; w: number; h: number }): boolean {
  return item.x >= -0.05 && item.y >= -0.05 && item.x + item.w <= roomW + 0.05 && item.y + item.h <= roomD + 0.05;
}

type Box = { key: string; x: number; y: number; w: number; h: number; under?: boolean };

function push(
  items: Drawn[],
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  detail: string,
  fill: string,
  extra: Partial<Drawn> = {},
) {
  items.push({ key, x, y, w, h, title, detail, fill, ...extra });
}

function placeDoor(pieces: Box[], roomW: number, roomD: number): Door {
  const length = 32;
  const swing = 32;
  for (let y = roomD - length; y >= 0; y -= 1) {
    const box = { x: 0, y, w: swing, h: length };
    if (!pieces.some((piece) => overlaps(piece, box))) return { wall: "left", x: 0, y, length, swing };
  }
  for (let x = 0; x <= roomW - length; x += 2) {
    const box = { x, y: roomD - swing, w: length, h: swing };
    if (!pieces.some((piece) => overlaps(piece, box))) return { wall: "bottom", x, y: roomD - length, length, swing };
  }
  return { wall: "left", x: 0, y: Math.max(0, roomD - length), length, swing };
}

function footWardrobes(items: Drawn[], roomW: number, roomD: number, measures: Measures) {
  const y = roomD - measures.wardrobe.d;
  const leftX = 40;
  push(items, "wardrobe-a", leftX, y, measures.wardrobe.w, measures.wardrobe.d, "Wardrobe", sizeLabel(measures.wardrobe), WARDROBE);
  push(
    items,
    "wardrobe-b",
    roomW - measures.wardrobe.w,
    y,
    measures.wardrobe.w,
    measures.wardrobe.d,
    "Wardrobe",
    sizeLabel(measures.wardrobe),
    WARDROBE,
  );
}

function stackInColumn(
  items: Drawn[],
  colX: number,
  colW: number,
  footY: number,
  suffix: string,
  measures: Measures,
  includeDesk: boolean,
  includeDresser: boolean,
  chairInFront: boolean,
) {
  const parts: { key: string; title: string; w: number; h: number; fill: string; detail: string }[] = [];
  if (includeDesk && !chairInFront) {
    parts.push({
      key: `chair-${suffix}`,
      title: "Chair",
      w: measures.chair.w,
      h: measures.chair.d,
      fill: CHAIR,
      detail: sizeLabel(measures.chair),
    });
  }
  if (includeDesk) {
    parts.push({
      key: `desk-${suffix}`,
      title: "Desk",
      w: measures.desk.d,
      h: measures.desk.w,
      fill: DESK,
      detail: sizeLabel(measures.desk),
    });
  }
  if (includeDresser) {
    parts.push({
      key: `dresser-${suffix}`,
      title: "Dresser",
      w: measures.dresser.d,
      h: measures.dresser.w,
      fill: DRESSER,
      detail: sizeLabel(measures.dresser),
    });
  }
  if (!parts.length) return;
  const sum = parts.reduce((total, part) => total + part.h, 0);
  const between = Math.max(parts.length - 1, 0);
  const spare = footY - sum;
  const gap = between && spare > 0 ? Math.min(4, spare / between) : 0;
  const lead = Math.max(0, Math.min(2, spare - gap * between));
  let y = lead;
  for (const part of parts) {
    const x = colX + Math.max(0, (colW - part.w) / 2);
    push(items, part.key, x, y, part.w, part.h, part.title, part.detail, part.fill);
    y += part.h + gap;
  }
  if (!chairInFront || !includeDesk) return;
  const desk = items.find((item) => item.key === `desk-${suffix}`);
  if (!desk) return;
  const chairW = measures.chair.d;
  const chairX = suffix === "a" ? desk.x + desk.w + 1 : desk.x - 1 - chairW;
  push(
    items,
    `chair-${suffix}`,
    chairX,
    desk.y + (desk.h - measures.chair.w) / 2,
    chairW,
    measures.chair.w,
    "Chair",
    sizeLabel(measures.chair),
    CHAIR,
  );
}

function underBed(items: Drawn[], bedX: number, bedW: number, measures: Measures, setup: Setup, suffix: string, face: "left" | "right") {
  const dresserUnder = setup === "mid" || setup === "high";
  const deskUnder = setup === "high";
  if (deskUnder) {
    const deskX = face === "left" ? bedX : bedX + bedW - measures.desk.d;
    push(items, `desk-${suffix}`, deskX, 2, measures.desk.d, measures.desk.w, "Desk", sizeLabel(measures.desk), DESK, { under: true });
    const chairX = face === "left" ? bedX + bedW + 1 : bedX - 1 - measures.chair.d;
    push(
      items,
      `chair-${suffix}`,
      chairX,
      2 + (measures.desk.w - measures.chair.w) / 2,
      measures.chair.d,
      measures.chair.w,
      "Chair",
      sizeLabel(measures.chair),
      CHAIR,
    );
  }
  if (dresserUnder) {
    const dressY = deskUnder ? 2 + measures.desk.w + 2 : 28;
    const dressX = bedX + (bedW - measures.dresser.w) / 2;
    push(
      items,
      `dresser-${suffix}`,
      dressX,
      dressY,
      measures.dresser.w,
      measures.dresser.d,
      "Dresser",
      sizeLabel(measures.dresser),
      DRESSER,
      { under: true },
    );
  }
}

function placeDouble(roomW: number, roomD: number, setup: Setup, measures: Measures): Drawn[] {
  const items: Drawn[] = [];
  const bedW = measures.bed.w;
  const bedL = measures.bed.d;
  const bunked = setup === "bunked";
  push(items, "bed-a", 0, 0, bedW, bedL, bunked ? "Bunks" : "Bed", sizeLabel(measures.bed), BED, { pillow: true, bunk: bunked });
  if (!bunked) {
    push(items, "bed-b", roomW - bedW, 0, bedW, bedL, "Bed", sizeLabel(measures.bed), BED, { pillow: true });
  }
  footWardrobes(items, roomW, roomD, measures);
  const footY = roomD - measures.wardrobe.d;
  const colW = Math.max(measures.desk.d, measures.dresser.d);
  const includeDesk = setup !== "high";
  const includeDresser = setup === "low" || setup === "bunked";
  if (bunked) {
    const left = bedW + 6;
    const right = left + colW + 10;
    stackInColumn(items, left, colW, footY, "a", measures, includeDesk, includeDresser, false);
    stackInColumn(items, right, colW, footY, "b", measures, includeDesk, includeDresser, false);
    return items;
  }
  const aisle = roomW - bedW * 2;
  const chairInFront = aisle >= measures.desk.d * 2 + measures.chair.d * 2 + 8;
  stackInColumn(items, bedW, colW, footY, "a", measures, includeDesk, includeDresser, chairInFront && includeDesk);
  stackInColumn(items, roomW - bedW - colW, colW, footY, "b", measures, includeDesk, includeDresser, chairInFront && includeDesk);
  underBed(items, 0, bedW, measures, setup, "a", "left");
  underBed(items, roomW - bedW, bedW, measures, setup, "b", "right");
  return items;
}

function placeApartment(roomW: number, roomD: number, setup: Setup, measures: Measures): Drawn[] {
  const items: Drawn[] = [];
  const bedL = measures.bed.d;
  const bedW = measures.bed.w;
  const bunked = setup === "bunked";
  push(items, "bed-a", 0, 0, bedL, bedW, bunked ? "Bunks" : "Bed", sizeLabel(measures.bed), BED, { pillow: true, bunk: bunked });
  const wardX = Math.min(bedL + 4, roomW - measures.wardrobe.w);
  push(items, "wardrobe-a", wardX, 0, measures.wardrobe.w, measures.wardrobe.d, "Wardrobe", sizeLabel(measures.wardrobe), WARDROBE);
  const deskUnder = setup === "high";
  const dresserUnder = setup === "mid" || setup === "high";
  if (deskUnder) {
    push(items, "desk-a", 2, 2, measures.desk.w, measures.desk.d, "Desk", sizeLabel(measures.desk), DESK, { under: true });
    push(
      items,
      "chair-a",
      2 + (measures.desk.w - measures.chair.w) / 2,
      bedW + 2,
      measures.chair.w,
      measures.chair.d,
      "Chair",
      sizeLabel(measures.chair),
      CHAIR,
    );
  } else {
    const deskY = roomD - measures.desk.d;
    const deskX = 40;
    push(items, "desk-a", deskX, deskY, measures.desk.w, measures.desk.d, "Desk", sizeLabel(measures.desk), DESK);
    push(
      items,
      "chair-a",
      deskX + (measures.desk.w - measures.chair.w) / 2,
      deskY - measures.chair.d - 2,
      measures.chair.w,
      measures.chair.d,
      "Chair",
      sizeLabel(measures.chair),
      CHAIR,
    );
  }
  if (dresserUnder) {
    const dressX = deskUnder ? 2 + measures.desk.w + 2 : 8;
    const dressY = deskUnder ? 2 : 8;
    const dressW = deskUnder ? measures.dresser.d : measures.dresser.w;
    const dressH = deskUnder ? measures.dresser.w : measures.dresser.d;
    push(items, "dresser-a", dressX, dressY, dressW, dressH, "Dresser", sizeLabel(measures.dresser), DRESSER, { under: true });
  } else {
    const deskX = 40;
    push(
      items,
      "dresser-a",
      deskX + measures.desk.w + 6,
      roomD - measures.dresser.d,
      measures.dresser.w,
      measures.dresser.d,
      "Dresser",
      sizeLabel(measures.dresser),
      DRESSER,
    );
  }
  return items;
}

export function layoutPieces(foot: RoomFootprint, setup: Setup, measures: Measures): { pieces: Drawn[]; door: Door } {
  const pieces = foot.occupants === 1 ? placeApartment(foot.width_in, foot.depth_in, setup, measures) : placeDouble(foot.width_in, foot.depth_in, setup, measures);
  const door = placeDoor(pieces, foot.width_in, foot.depth_in);
  return { pieces, door };
}

export function elevationWidth(setup: Setup, measures: Measures): number {
  let width = measures.bed.d;
  if (setup !== "high") width += 6 + measures.desk.w;
  width += 6 + measures.wardrobe.w + 8;
  return width;
}

export function elevationHeight(measures: Measures): number {
  return 16 + measures.wardrobe.h + 8;
}

export function framePlan(foot: RoomFootprint, setup: Setup, measures: Measures): RoomPlan {
  const { pieces, door } = layoutPieces(foot, setup, measures);
  const dimLeft = 30;
  const dimTop = 28;
  const elevW = elevationWidth(setup, measures);
  const elevH = elevationHeight(measures);
  const elevX = dimLeft + foot.width_in + 24;
  const elevY = dimTop;
  return {
    pieces: pieces.map((piece) => ({ ...piece, x: piece.x + dimLeft, y: piece.y + dimTop })),
    door: { ...door, x: door.x + dimLeft, y: door.y + dimTop },
    room: { x: dimLeft, y: dimTop, w: foot.width_in, h: foot.depth_in },
    elevX,
    elevY,
    elevW,
    elevH,
    width: elevX + elevW + 10,
    height: Math.max(dimTop + foot.depth_in, elevY + elevH) + 14,
  };
}

export function auditLayout(foot: RoomFootprint, setup: Setup, measures: Measures): string[] {
  const { pieces, door } = layoutPieces(foot, setup, measures);
  const problems: string[] = [];
  for (const piece of pieces) {
    if (!inside(foot.width_in, foot.depth_in, piece)) problems.push(`outside ${piece.key}`);
  }
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const a = pieces[i];
      const b = pieces[j];
      if (!overlaps(a, b)) continue;
      const bedKeys = new Set(["bed-a", "bed-b"]);
      const underBedPair = (a.under && bedKeys.has(b.key)) || (b.under && bedKeys.has(a.key));
      if (underBedPair) continue;
      problems.push(`overlap ${a.key} ${b.key}`);
    }
  }
  const swing =
    door.wall === "left"
      ? { x: 0, y: door.y, w: door.swing, h: door.length }
      : { x: door.x, y: foot.depth_in - door.swing, w: door.length, h: door.swing };
  if (pieces.some((piece) => overlaps(piece, swing))) problems.push("door");
  const beds = pieces.filter((piece) => piece.key.startsWith("bed"));
  if (foot.occupants === 1 && beds.length !== 1) problems.push("bed count");
  if (foot.occupants === 2 && setup !== "bunked" && beds.length !== 2) problems.push("bed count");
  if (setup === "bunked" && beds.length !== 1) problems.push("bunk count");
  return problems;
}

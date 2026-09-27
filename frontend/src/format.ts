export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TAG_LABELS: Record<string, string> = {
  woman: "Woman",
  man: "Man",
  nonbinary: "Nonbinary",
  early: "Early",
  typical: "Typical",
  late: "Late",
  nocturnal: "Nocturnal",
  spotless: "Spotless",
  tidy: "Tidy",
  average: "Average",
  relaxed: "Relaxed",
  messy: "Messy",
  traditional: "Traditional",
  suite: "Suite",
  apartment: "Apartment",
  "first-year": "First-year",
  "second-year": "Second-year",
  "third-year": "Third-year",
  "fourth-year": "Fourth-year",
  "fifth-year+": "Fifth-year+",
  graduate: "Graduate",
};

export function tagLabel(tag: string): string {
  const known = TAG_LABELS[tag.trim().toLowerCase()];
  if (known) return known;
  return tag.replace(/(^|[\s-])([a-z])/g, (_match, boundary: string, letter: string) => boundary + letter.toUpperCase());
}

export function formatDay(value: string): string {
  const date = parseIso(value);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatDates(values: string[]): string {
  const days = [...new Set(values.filter(Boolean))].sort();
  if (!days.length) return "";
  const ranges: string[][] = [[days[0]]];
  for (const day of days.slice(1)) {
    const current = ranges[ranges.length - 1];
    const previous = parseIso(current[current.length - 1]);
    if (isoDate(addDays(previous, 1)) === day) current.push(day);
    else ranges.push([day]);
  }
  return ranges.map(formatRange).join(", ");
}

function formatRange(days: string[]): string {
  const start = parseIso(days[0]);
  const startLabel = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  if (days.length === 1) return startLabel;
  const end = parseIso(days[days.length - 1]);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${startLabel}-${end.getDate()}`;
  }
  return `${startLabel}-${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Saturday of the weekend to offer first. On Saturday or Sunday the current one is ending, so this is the next Saturday. */
export function upcomingSaturday(today = startOfToday()): Date {
  const weekday = today.getDay();
  if (weekday === 6) return addDays(today, 7);
  if (weekday === 0) return addDays(today, 6);
  return addDays(today, 6 - weekday);
}

export function defaultDates(): string[] {
  const saturday = upcomingSaturday();
  return [isoDate(saturday), isoDate(addDays(saturday, 1))];
}

/** Saturday and Sunday of the weekend already underway. Empty Monday through Friday. */
export function endingWeekend(today = startOfToday()): string[] {
  const weekday = today.getDay();
  if (weekday === 6) return [isoDate(today), isoDate(addDays(today, 1))];
  if (weekday === 0) return [isoDate(today)];
  return [];
}

export function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function upcomingDays(count: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => isoDate(addDays(today, index)));
}

export function matchPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function placeLabel(dorm?: string | null, unit?: string | null): string {
  const place = [dorm, unit].filter(Boolean).join(" ");
  return place || "Off campus";
}

export function styleLabel(style?: string | null): string {
  if (style === "suite") return "Suite";
  if (style === "apartment") return "Apartment";
  if (style === "traditional") return "Traditional";
  return style || "";
}

export function sleepLabel(value?: string | null): string {
  if (value === "early") return "Early sleeper";
  if (value === "typical") return "Typical hours";
  if (value === "late") return "Late hours";
  if (value === "nocturnal") return "Nocturnal";
  return value || "";
}

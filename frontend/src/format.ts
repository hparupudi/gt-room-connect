export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(value: string): string {
  return parseIso(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDates(values: string[]): string {
  return [...values].sort().map(formatDay).join(", ");
}

export function defaultDates(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekday = today.getDay();
  if (weekday === 6) return [isoDate(today), isoDate(addDays(today, 1))];
  if (weekday === 0) return [isoDate(today)];
  const saturday = addDays(today, 6 - weekday);
  return [isoDate(saturday), isoDate(addDays(saturday, 1))];
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

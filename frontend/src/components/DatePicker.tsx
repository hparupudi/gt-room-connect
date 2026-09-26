import { useMemo, useState } from "react";

import { useDates } from "../dates";
import { addDays, formatDates, isoDate, parseIso } from "../format";

export function DatePicker() {
  const { dates, toggleDate, setDates } = useDates();
  const [cursor, setCursor] = useState(() => parseIso(dates[0] ?? isoDate(new Date())));

  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chips: { label: string; days: string[] }[] = [];
    const start = new Date(today);
    const weekday = start.getDay();
    if (weekday !== 6) start.setDate(start.getDate() + ((6 - weekday + 7) % 7));
    for (let index = 0; index < 4; index += 1) {
      const saturday = addDays(start, index * 7);
      const sunday = addDays(saturday, 1);
      const days = [isoDate(saturday)];
      if (sunday >= today) days.push(isoDate(sunday));
      const open = days.filter((day) => parseIso(day) >= today);
      chips.push({
        label: index === 0 && weekday === 6 ? "This weekend" : formatDates(open),
        days: open,
      });
    }
    return chips.filter((chip) => chip.days.length);
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = isoDate(new Date());
  const cells: Array<string | null> = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => isoDate(new Date(year, month, index + 1))),
  ];

  return (
    <div className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-gold uppercase">Dates</p>
          <p className="mt-1 text-sm text-muted">Required. A bed has to be free every night you pick.</p>
        </div>
        <p className="text-sm font-medium">{dates.length ? formatDates(dates) : "None yet"}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {weeks.map((week) => {
          const on = week.days.every((day) => dates.includes(day));
          return (
            <button
              key={week.label + week.days[0]}
              type="button"
              onClick={() => {
                if (on) setDates(dates.filter((day) => !week.days.includes(day)));
                else setDates([...dates, ...week.days]);
              }}
              className={`rounded-full px-3 py-1.5 text-sm ${on ? "bg-navy text-paper" : "bg-paper text-ink"}`}
            >
              {week.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" className="text-sm text-navy" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          Previous
        </button>
        <p className="font-serif text-lg">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <button type="button" className="text-sm text-navy" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          Next
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
          <div key={`${label}-${index}`}>{label}</div>
        ))}
        {cells.map((day, index) =>
          day ? (
            <button
              key={day}
              type="button"
              disabled={day < todayIso}
              onClick={() => toggleDate(day)}
              className={`rounded-lg py-2 text-sm disabled:text-muted/40 ${
                dates.includes(day) ? "bg-navy text-paper" : "hover:bg-paper"
              }`}
            >
              {parseIso(day).getDate()}
            </button>
          ) : (
            <div key={`empty-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

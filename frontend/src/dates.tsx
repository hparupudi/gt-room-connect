import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { defaultDates } from "./format";

type DatesValue = {
  dates: string[];
  setDates: (dates: string[]) => void;
  toggleDate: (date: string) => void;
};

const DatesContext = createContext<DatesValue | null>(null);
const KEY = "dormsurf-dates";
const LEGACY_KEY = "nook-dates";

function loadDates(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY) || sessionStorage.getItem(LEGACY_KEY);
    if (!raw) return defaultDates();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string") && parsed.length) {
      return parsed;
    }
  } catch {
    /* use the upcoming weekend */
  }
  return defaultDates();
}

export function DatesProvider({ children }: { children: ReactNode }) {
  const [dates, setDatesState] = useState<string[]>(loadDates);

  const setDates = (next: string[]) => {
    const unique = [...new Set(next)].sort();
    setDatesState(unique);
    sessionStorage.setItem(KEY, JSON.stringify(unique));
  };

  const toggleDate = (date: string) => {
    setDates(dates.includes(date) ? dates.filter((item) => item !== date) : [...dates, date]);
  };

  const value = useMemo(() => ({ dates, setDates, toggleDate }), [dates]);
  return <DatesContext.Provider value={value}>{children}</DatesContext.Provider>;
}

export function useDates(): DatesValue {
  const value = useContext(DatesContext);
  if (!value) throw new Error("DatesProvider is missing");
  return value;
}

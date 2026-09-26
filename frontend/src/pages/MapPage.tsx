import { DatePicker } from "../components/DatePicker";
import { DormBrowser } from "../components/DormBrowser";
import { Shell } from "../components/Shell";
import { useDates } from "../dates";

export function MapPage() {
  const { dates } = useDates();
  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-gold uppercase">Campus</p>
          <h1 className="font-serif text-4xl text-navy">Every hall, floor by floor.</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Click a building for its floor plan. Click a unit to get the walk there from your own room, along real campus paths.
          </p>
        </div>
      </div>
      <div className="mb-5 max-w-xl">
        <DatePicker />
      </div>
      <DormBrowser dates={dates} mode="browse" />
    </Shell>
  );
}

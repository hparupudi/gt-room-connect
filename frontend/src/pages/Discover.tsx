import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { DatePicker } from "../components/DatePicker";
import { Shell } from "../components/Shell";
import { Avatar, Banner, Tags, btnGhost, btnPrimary } from "../components/ui";
import { useDates } from "../dates";
import { formatDates, matchPercent, sleepLabel, styleLabel } from "../format";
import type { SearchResponse } from "../types";

type Multi = string[] | null;

export function Discover() {
  const { token, meta } = useAuth();
  const { dates } = useDates();
  const [query, setQuery] = useState("");
  const [sleep, setSleep] = useState<Multi>(null);
  const [cleanliness, setClean] = useState<Multi>(null);
  const [years, setYears] = useState<Multi>(null);
  const [majors, setMajors] = useState<Multi>(null);
  const [genders, setGenders] = useState<Multi>(null);
  const [floors, setFloors] = useState<Multi>(null);
  const [styles, setStyles] = useState<Multi>(null);
  const [sort, setSort] = useState<"match" | "distance">("match");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filterKey = JSON.stringify({ query, dates, sleep, cleanliness, years, majors, genders, floors, styles, sort });

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (!dates.length) {
      setData(null);
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError("");
      api<SearchResponse>(
        "/api/search",
        {
          method: "POST",
          body: JSON.stringify({
            query,
            dates,
            sleep: sleep ?? [],
            cleanliness: cleanliness ?? [],
            years: years ?? [],
            majors: majors ?? [],
            genders: genders ?? [],
            floors: (floors ?? []).map(Number),
            styles: styles ?? [],
            sort,
            page,
            page_size: 6,
          }),
        },
        token,
      )
        .then(setData)
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Search failed."))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [filterKey, page, token, dates, query, sleep, cleanliness, years, majors, genders, floors, styles, sort]);

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-gold uppercase">Discover</p>
          <h1 className="font-serif text-4xl text-navy">Who's free when you are?</h1>
        </div>
        <div className="flex rounded-full bg-card p-1">
          {(["match", "distance"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className={`rounded-full px-4 py-2 text-sm ${sort === option ? "bg-navy text-paper" : ""}`}
            >
              {option === "match" ? "Sort by match" : "Sort by distance"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Search names, halls, units, bios</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Glenn, 314, climbing…" />
          </label>
          <DatePicker />
          <FilterGroup label="Sleep" options={(meta?.sleep ?? []).map((item) => item.id)} selected={sleep} onChange={setSleep} labelOf={(id) => sleepLabel(id)} />
          <FilterGroup
            label="Cleanliness"
            options={(meta?.cleanliness ?? []).map((item) => item.id)}
            selected={cleanliness}
            onChange={setClean}
          />
          <FilterGroup label="Year" options={(meta?.years ?? []).map((item) => item.id)} selected={years} onChange={setYears} labelOf={(id) => meta?.years.find((item) => item.id === id)?.label || id} />
          <FilterGroup label="Gender" options={(meta?.genders ?? []).map((item) => item.id)} selected={genders} onChange={setGenders} labelOf={(id) => meta?.genders.find((item) => item.id === id)?.label || id} />
          <FilterGroup label="Floor" options={["1", "2", "3", "4", "5", "6", "7", "8"]} selected={floors} onChange={setFloors} />
          <FilterGroup label="Dorm type" options={(meta?.styles ?? []).map((item) => item.id)} selected={styles} onChange={setStyles} labelOf={(id) => styleLabel(id)} />
          <details className="rounded-3xl border border-line bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">Majors {majors ? `(${majors.length})` : "(all)"}</summary>
            <div className="mt-3 flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setMajors(null)}>
                Select all
              </button>
            </div>
            <ul className="mt-3 max-h-56 space-y-1 overflow-auto text-sm">
              {(meta?.majors ?? []).map((major) => {
                const on = majors === null || majors.includes(major);
                return (
                  <li key={major}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={on}
                        onChange={() => {
                          const all = meta?.majors ?? [];
                          const current = majors ?? all;
                          const next = current.includes(major) ? current.filter((item) => item !== major) : [...current, major];
                          setMajors(next.length === all.length ? null : next);
                        }}
                      />
                      {major}
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        </aside>
        <section>
          {!dates.length ? <Banner tone="note">Pick at least one date. Nook won't guess which night you need.</Banner> : null}
          {error ? <Banner>{error}</Banner> : null}
          {data ? (
            <p className="mb-3 text-sm text-muted">
              {data.total} couch{data.total === 1 ? "" : "es"} · {data.sort === "match" ? "best match first" : "closest walk first"} ·{" "}
              {data.ranker === "muse-spark-1.3" ? "reranked by Muse Spark 1.3" : "ranked with lifestyle vectors"}
            </p>
          ) : null}
          {loading && !data ? <p className="text-sm text-muted">Looking through open rooms…</p> : null}
          <div className="grid gap-4">
            {data?.results.map(({ host, scores }) => (
              <article key={host.id} className="rounded-[28px] border border-line bg-card p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={host.name || "Student"} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs tracking-[0.14em] text-gold uppercase">
                      {host.dorm_name} {host.unit} · {styleLabel(host.style)}
                    </p>
                    <h2 className="font-serif text-3xl">{host.name}</h2>
                    <p className="text-sm text-muted">
                      {host.year_label} {host.major} · {host.hometown}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-3xl text-navy">{sort === "distance" ? `${scores.minutes}m` : matchPercent(scores.match)}</p>
                    <p className="text-xs text-muted">{sort === "distance" ? "walk" : "match"}</p>
                    <p className="mt-1 text-xs text-muted">{sort === "distance" ? matchPercent(scores.match) : `${scores.minutes} min`}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6">{host.bio}</p>
                <p className="mt-2 text-sm text-navy">{scores.reason}</p>
                <div className="mt-3">
                  <Tags tags={host.tags} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted">Open {formatDates(host.open_dates.filter((day) => dates.includes(day)))}</p>
                  <Link to={`/room/${host.id}`} className={btnPrimary}>
                    View couch
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {data && data.total === 0 ? (
            <Banner tone="note">Nobody open matches that. Widen the dates or clear a filter.</Banner>
          ) : null}
          {data && data.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <p className="text-sm text-muted">
                Page {data.page} of {data.pages}
              </p>
              <button type="button" className={btnGhost} disabled={page >= data.pages} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onChange,
  labelOf,
}: {
  label: string;
  options: string[];
  selected: Multi;
  onChange: (next: Multi) => void;
  labelOf?: (id: string) => string;
}) {
  return (
    <fieldset className="rounded-3xl border border-line bg-card p-4">
      <legend className="px-1 text-sm font-medium">
        {label} <span className="font-normal text-muted">{selected ? "" : "· all"}</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange(null)} className={`rounded-full px-2.5 py-1 text-xs ${selected === null ? "bg-navy text-paper" : "bg-paper"}`}>
          All
        </button>
        {options.map((option) => {
          const on = selected === null || selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                const current = selected ?? options;
                const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
                onChange(next.length === 0 || next.length === options.length ? null : next);
              }}
              className={`rounded-full px-2.5 py-1 text-xs ${on ? "bg-navy text-paper" : "bg-paper"}`}
            >
              {labelOf ? labelOf(option) : option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

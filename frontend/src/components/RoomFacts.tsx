import type { HousingFacts } from "../types";

export function RoomFacts({ unit, housing }: { unit: string; housing: HousingFacts | null | undefined }) {
  if (!housing) {
    return (
      <section className="rounded-[28px] border border-line bg-card p-5">
        <h3 className="font-serif text-2xl text-navy">Room {unit}</h3>
        <p className="mt-2 text-sm text-muted">Housing hasn't published furniture sizes or amenities for this hall.</p>
      </section>
    );
  }
  return (
    <section className="rounded-[28px] border border-line bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">Georgia Tech Housing</p>
      <h3 className="font-serif text-3xl text-navy">Room {unit}</h3>
      {housing.room_style ? <p className="mt-1 text-sm text-muted">{housing.room_style}</p> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-medium">Dimensions</h4>
          {housing.dimensions.length ? (
            <ul className="mt-2 space-y-3">
              {housing.dimensions.map((piece) => (
                <li key={piece.name}>
                  <p className="text-sm font-medium">{piece.name}</p>
                  <ul className="mt-1 text-sm text-muted">
                    {(piece.lines || []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Housing doesn't list a separate size for this room.</p>
          )}
          {housing.furniture_note ? <p className="mt-3 text-xs text-muted">{housing.furniture_note}</p> : null}
        </div>
        <div>
          <h4 className="text-sm font-medium">Amenities</h4>
          {housing.amenities.length ? (
            <ul className="mt-2 space-y-2">
              {housing.amenities.map((item) => (
                <li key={item.name} className="text-sm">
                  <span className="font-medium">{item.name}</span>
                  {item.detail ? <span className="text-muted"> · {item.detail}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No building amenities are listed for this hall.</p>
          )}
        </div>
      </div>
      {housing.page ? (
        <a href={housing.page} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-navy underline">
          Open this hall on Housing
        </a>
      ) : null}
    </section>
  );
}

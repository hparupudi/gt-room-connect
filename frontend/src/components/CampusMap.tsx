import { Component, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import type { DormPin, Route } from "../types";

// OpenStreetMap's standard tiles need no key. Set VITE_TILE_URL to swap in a
// keyed provider (CARTO, Stadia, MapTiler) without touching the code.
const TILES = import.meta.env.VITE_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  import.meta.env.VITE_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CAMPUS_BOUNDS: LatLngBoundsExpression = [
  [33.7665, -84.4095],
  [33.7845, -84.3855],
];

const FILL = {
  yours: "#003057",
  open: "#1f6b45",
  idle: "#8d8476",
};

function hallTone(dorm: { yours: boolean; open_units: number }): keyof typeof FILL {
  if (dorm.yours) return "yours";
  if (dorm.open_units) return "open";
  return "idle";
}

function CampusMapView({
  dorms,
  selectedId,
  zoomToId,
  onSelect,
  route,
  focus,
  height = "min(70vh, 640px)",
  interactive = true,
}: {
  dorms: DormPin[];
  selectedId?: string;
  /** Set only from a user action; the initial view keeps the whole campus in frame. */
  zoomToId?: string;
  onSelect?: (id: string) => void;
  route?: Route | null;
  focus?: [number, number][] | null;
  height?: string;
  interactive?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-line shadow-sm" style={{ height }}>
      <MapContainer
        bounds={CAMPUS_BOUNDS}
        maxBounds={[
          [33.755, -84.425],
          [33.795, -84.37],
        ]}
        minZoom={14}
        maxZoom={19}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        className="h-full w-full bg-[#eef0e7]"
      >
        <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} className="dormsurf-tiles" />
        {dorms.map((dorm) => {
          const tone = hallTone(dorm);
          const active = dorm.id === selectedId;
          const style = {
            color: active ? "#8d6e2f" : "#fffaf3",
            weight: active ? 3 : 1.2,
            fillColor: FILL[tone],
            fillOpacity: active ? 0.95 : tone === "idle" ? 0.6 : 0.88,
          };
          const label = dorm.yours
            ? "Your hall"
            : dorm.open_units
              ? `${dorm.open_units} unit${dorm.open_units === 1 ? "" : "s"} open`
              : "Nobody hosting";
          return (
            <Polygon
              key={dorm.id}
              positions={dorm.footprint as LatLngExpression[][]}
              pathOptions={style}
              eventHandlers={{ click: () => onSelect?.(dorm.id) }}
            >
              <Tooltip sticky direction="top" opacity={1} className="dormsurf-tip">
                <strong>{dorm.name}</strong>
                <br />
                {label}
              </Tooltip>
            </Polygon>
          );
        })}
        {dorms
          .filter((dorm) => dorm.yours || dorm.open_units || dorm.id === selectedId)
          .map((dorm) => {
            const tone = hallTone(dorm);
            return (
              <CircleMarker
                key={`pin-${dorm.id}`}
                center={[dorm.lat, dorm.lng]}
                radius={dorm.id === selectedId ? 9 : 7}
                pathOptions={{ color: "#fffaf3", weight: 2, fillColor: FILL[tone], fillOpacity: 1 }}
                eventHandlers={{ click: () => onSelect?.(dorm.id) }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1} className="dormsurf-tip">
                  <strong>{dorm.name}</strong>
                  <br />
                  {dorm.yours ? "Your hall" : `${dorm.open_units} unit${dorm.open_units === 1 ? "" : "s"} open`}
                </Tooltip>
              </CircleMarker>
            );
          })}
        {route && route.points.length > 1 ? (
          <>
            <Polyline positions={route.points} pathOptions={{ color: "#fffaf3", weight: 8, opacity: 0.9 }} />
            <Polyline
              positions={route.points}
              pathOptions={{ color: "#8d6e2f", weight: 4, dashArray: route.source === "estimate" ? "8 8" : undefined }}
            />
            <CircleMarker center={route.points[0]} radius={7} pathOptions={{ color: "#fffaf3", weight: 2, fillColor: "#003057", fillOpacity: 1 }}>
              <Tooltip permanent direction="left" offset={[-8, 0]} className="dormsurf-tip">
                {route.from?.unit ? `${route.from.dorm_name} ${route.from.unit}` : route.from?.dorm_name || "Start"}
              </Tooltip>
            </CircleMarker>
            <CircleMarker
              center={route.points[route.points.length - 1]}
              radius={7}
              pathOptions={{ color: "#fffaf3", weight: 2, fillColor: "#a84b28", fillOpacity: 1 }}
            >
              <Tooltip permanent direction="right" offset={[8, 0]} className="dormsurf-tip">
                {route.to?.unit ? `${route.to.dorm_name} ${route.to.unit}` : route.to?.dorm_name || "Destination"}
              </Tooltip>
            </CircleMarker>
          </>
        ) : null}
        <Focus points={focus ?? (route && route.points.length > 1 ? route.points : null)} zoomToId={zoomToId} dorms={dorms} />
      </MapContainer>
    </div>
  );
}

function Focus({ points, zoomToId, dorms }: { points: [number, number][] | null; zoomToId?: string; dorms: DormPin[] }) {
  const map = useMap();
  const lastZoom = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (points && points.length > 1) {
      map.fitBounds(points, { padding: [48, 48], maxZoom: 17 });
      return;
    }
    if (!zoomToId || zoomToId === lastZoom.current) return;
    lastZoom.current = zoomToId;
    const dorm = dorms.find((item) => item.id === zoomToId);
    if (dorm) {
      map.flyTo([dorm.lat, dorm.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
  }, [points, zoomToId, dorms, map]);
  useEffect(() => {
    const handle = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(handle);
  }, [map]);
  return null;
}

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="rounded-[28px] border border-line bg-card px-4 py-8 text-sm text-muted">
          The campus map couldn't be drawn. The hall list still works.
        </p>
      );
    }
    return this.props.children;
  }
}

export function CampusMap(props: Parameters<typeof CampusMapView>[0]) {
  return (
    <MapBoundary>
      <CampusMapView {...props} />
    </MapBoundary>
  );
}

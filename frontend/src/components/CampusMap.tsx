import { useEffect } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import type { DormPin, Route } from "../types";

const TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const LABELS = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const CAMPUS_BOUNDS: LatLngBoundsExpression = [
  [33.7665, -84.4095],
  [33.7845, -84.3855],
];

const FILL = {
  yours: "#003057",
  open: "#1f6b45",
  idle: "#8d8476",
};

export function hallTone(dorm: { yours: boolean; open_units: number }): keyof typeof FILL {
  if (dorm.yours) return "yours";
  if (dorm.open_units) return "open";
  return "idle";
}

export function CampusMap({
  dorms,
  selectedId,
  onSelect,
  route,
  focus,
  height = "min(70vh, 640px)",
  interactive = true,
}: {
  dorms: DormPin[];
  selectedId?: string;
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
        <TileLayer url={TILES} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={20} />
        <TileLayer url={LABELS} subdomains="abcd" maxZoom={20} pane="shadowPane" />
        {dorms.map((dorm) => {
          const tone = hallTone(dorm);
          const active = dorm.id === selectedId;
          const style = {
            color: active ? "#8d6e2f" : "#fffaf3",
            weight: active ? 3 : 1.2,
            fillColor: FILL[tone],
            fillOpacity: active ? 0.95 : tone === "idle" ? 0.55 : 0.85,
          };
          return (
            <Polygon
              key={dorm.id}
              positions={dorm.footprint as LatLngExpression[][]}
              pathOptions={style}
              eventHandlers={{ click: () => onSelect?.(dorm.id) }}
            >
              <Tooltip sticky direction="top" opacity={1} className="nook-tip">
                <strong>{dorm.name}</strong>
                <br />
                {dorm.yours ? "Your hall" : dorm.open_units ? `${dorm.open_units} unit${dorm.open_units === 1 ? "" : "s"} open` : "Nobody hosting"}
              </Tooltip>
            </Polygon>
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
              <Tooltip permanent direction="left" offset={[-8, 0]} className="nook-tip">
                {route.from?.unit ? `${route.from.dorm_name} ${route.from.unit}` : route.from?.dorm_name || "Start"}
              </Tooltip>
            </CircleMarker>
            <CircleMarker
              center={route.points[route.points.length - 1]}
              radius={7}
              pathOptions={{ color: "#fffaf3", weight: 2, fillColor: "#a84b28", fillOpacity: 1 }}
            >
              <Tooltip permanent direction="right" offset={[8, 0]} className="nook-tip">
                {route.to?.unit ? `${route.to.dorm_name} ${route.to.unit}` : route.to?.dorm_name || "Destination"}
              </Tooltip>
            </CircleMarker>
          </>
        ) : null}
        <Focus points={focus ?? (route && route.points.length > 1 ? route.points : null)} selectedId={selectedId} dorms={dorms} />
      </MapContainer>
    </div>
  );
}

function Focus({ points, selectedId, dorms }: { points: [number, number][] | null; selectedId?: string; dorms: DormPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 1) {
      map.fitBounds(points, { padding: [48, 48], maxZoom: 17 });
      return;
    }
    const dorm = dorms.find((item) => item.id === selectedId);
    if (dorm) {
      map.flyTo([dorm.lat, dorm.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
    }
  }, [points, selectedId, dorms, map]);
  useEffect(() => {
    const handle = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(handle);
  }, [map]);
  return null;
}

import { CONFIG } from "../config.js";

export async function osrmRoute(from, to) {
  const url = `${CONFIG.osrmUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("no_route");
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) throw new Error("no_route");
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}

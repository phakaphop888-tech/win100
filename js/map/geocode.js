import { CONFIG } from "../config.js";
import { debounce } from "../utils.js";

export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${CONFIG.nominatimUrl}/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}&accept-language=th`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("network");
  const rows = await res.json();
  return rows.map((r) => ({
    name: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

export async function reverseGeocode(lat, lng) {
  const url = `${CONFIG.nominatimUrl}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=th`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const json = await res.json();
  return json.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export const searchPlacesDebounced = (query, cb) => {
  const run = debounce(async () => {
    try {
      cb(await searchPlaces(query));
    } catch {
      cb([]);
    }
  }, 320);
  run();
};

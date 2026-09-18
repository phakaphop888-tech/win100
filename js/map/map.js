import { CONFIG } from "../config.js";

let Lref = null;

function L() {
  if (!window.L) throw new Error("no_route");
  Lref = window.L;
  return Lref;
}

export function createMap(el, center = CONFIG.defaultCenter) {
  const map = L().map(el, { zoomControl: false, attributionControl: true }).setView(center, 14);
  L().tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
  L().control.zoom({ position: "topright" }).addTo(map);
  return map;
}

export function divIcon(color, inner = "") {
  return L().divIcon({
    className: "",
    html: `<div class="marker-dot" style="background:${color}">${inner}</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function setMarker(map, marker, latlng, icon) {
  if (!latlng) return marker;
  if (marker) {
    marker.setLatLng(latlng);
    return marker;
  }
  return L().marker(latlng, { icon }).addTo(map);
}

export function drawRoute(map, layer, coords) {
  if (layer) map.removeLayer(layer);
  if (!coords?.length) return null;
  const line = L().polyline(coords, { color: "#121110", weight: 5, opacity: 0.85 }).addTo(map);
  map.fitBounds(line.getBounds(), { padding: [40, 40] });
  return line;
}

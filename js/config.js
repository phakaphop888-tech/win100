const defaults = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  osrmUrl: "https://router.project-osrm.org",
  nominatimUrl: "https://nominatim.openstreetmap.org",
  defaultCenter: [13.7563, 100.5018],
  gpsMinIntervalMs: 4000,
  gpsMinDistanceM: 12,
};

let local = {};
try {
  local = await import("./config.local.js");
} catch {
  local = {};
}

export const CONFIG = {
  ...defaults,
  ...local.CONFIG,
};

export function assertConfig() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
    throw new Error("missing_config");
  }
}

import { getSupabase } from "../supabase.js";

export function subscribeDriverLocation(driverId, onChange) {
  const ch = getSupabase()
    .channel(`loc:${driverId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
      (payload) => onChange(payload.new)
    )
    .subscribe();
  return () => getSupabase().removeChannel(ch);
}

export function subscribeAllLocations(onChange) {
  const ch = getSupabase()
    .channel("loc-all")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "driver_locations" },
      (payload) => onChange(payload.new)
    )
    .subscribe();
  return () => getSupabase().removeChannel(ch);
}

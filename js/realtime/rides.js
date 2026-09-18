import { getSupabase } from "../supabase.js";

export function subscribeRide(rideId, onChange) {
  const ch = getSupabase()
    .channel(`ride:${rideId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
      (payload) => onChange(payload.new || payload.old, payload)
    )
    .subscribe();
  return () => getSupabase().removeChannel(ch);
}

export function subscribeDriverRides(driverId, onChange) {
  const ch = getSupabase()
    .channel(`driver-rides:${driverId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rides", filter: `driver_id=eq.${driverId}` },
      (payload) => onChange(payload.new, payload)
    )
    .subscribe();
  return () => getSupabase().removeChannel(ch);
}

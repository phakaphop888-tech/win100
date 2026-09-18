import { getSupabase } from "../supabase.js";

export async function requestRide(payload) {
  const { data, error } = await getSupabase().rpc("request_ride", payload);
  if (error) throw error;
  return data;
}

export async function retryMatch(rideId) {
  const { data, error } = await getSupabase().rpc("retry_match", { p_ride_id: rideId });
  if (error) throw error;
  return data;
}

export async function cancelRide(rideId, reason) {
  const { data, error } = await getSupabase().rpc("cancel_ride", { p_ride_id: rideId, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function acceptRide(rideId) {
  const { data, error } = await getSupabase().rpc("driver_accept_ride", { p_ride_id: rideId });
  if (error) throw error;
  return data;
}

export async function rejectRide(rideId) {
  const { data, error } = await getSupabase().rpc("driver_reject_ride", { p_ride_id: rideId });
  if (error) throw error;
  return data;
}

export async function updateRideStatus(rideId, to) {
  const { data, error } = await getSupabase().rpc("driver_update_ride_status", {
    p_ride_id: rideId,
    p_to: to,
  });
  if (error) throw error;
  return data;
}

export async function fetchRide(id) {
  const sb = getSupabase();
  const { data, error } = await sb.from("rides").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [{ data: passenger }, pay, rate] = await Promise.all([
    sb.from("profiles").select("id, full_name, phone").eq("id", data.passenger_id).maybeSingle(),
    sb.from("payments").select("*").eq("ride_id", id),
    sb.from("ratings").select("*").eq("ride_id", id),
  ]);
  let driver = null;
  if (data.driver_id) {
    const { data: d } = await sb
      .from("drivers")
      .select("id, rating_avg, profile_id")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (d) {
      const [{ data: vehicles }, { data: profiles }] = await Promise.all([
        sb.from("vehicles").select("*").eq("driver_id", d.id).maybeSingle(),
        sb.from("profiles").select("full_name, phone").eq("id", d.profile_id).maybeSingle(),
      ]);
      driver = { ...d, vehicles, profiles };
    }
  }
  return { ...data, passenger, driver, payments: pay.data || [], ratings: rate.data || [] };
}

export async function fetchRideHistory() {
  const { data, error } = await getSupabase()
    .from("rides")
    .select("id, status, pickup_address, dropoff_address, fare_amount, created_at, distance_km")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function fetchActiveRideForPassenger(uid) {
  const { data, error } = await getSupabase()
    .from("rides")
    .select("*")
    .eq("passenger_id", uid)
    .not("status", "in", "(TRIP_COMPLETED,CANCELLED)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchActiveRideForDriver(driverId) {
  const { data, error } = await getSupabase()
    .from("rides")
    .select("*")
    .eq("driver_id", driverId)
    .not("status", "in", "(TRIP_COMPLETED,CANCELLED)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchHistoryTimeline(rideId) {
  const { data, error } = await getSupabase()
    .from("ride_status_history")
    .select("*")
    .eq("ride_id", rideId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getSettings() {
  const { data, error } = await getSupabase().rpc("get_platform_settings");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function calculateFare(distanceKm) {
  const { data, error } = await getSupabase().rpc("calculate_fare", { p_distance_km: distanceKm });
  if (error) throw error;
  return data;
}

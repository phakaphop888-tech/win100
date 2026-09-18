import { getSupabase } from "../supabase.js";
import { CONFIG } from "../config.js";
import { haversineKm } from "../utils.js";

let lastSent = { t: 0, lat: null, lng: null };

export function shouldSendGps(point) {
  const now = Date.now();
  if (now - lastSent.t < CONFIG.gpsMinIntervalMs) return false;
  if (lastSent.lat != null) {
    const d = haversineKm(
      { lat: lastSent.lat, lng: lastSent.lng },
      { lat: point.lat, lng: point.lng }
    );
    if (d * 1000 < CONFIG.gpsMinDistanceM && now - lastSent.t < 15000) return false;
  }
  lastSent = { t: now, lat: point.lat, lng: point.lng };
  return true;
}

export async function sendDriverGps(point) {
  if (!shouldSendGps(point)) return null;
  const { data, error } = await getSupabase().rpc("upsert_driver_location", {
    p_lat: point.lat,
    p_lng: point.lng,
    p_accuracy: point.accuracy,
    p_heading: point.heading,
    p_speed: point.speed,
  });
  if (error) throw error;
  return data;
}

export async function setOnline(online) {
  const { data, error } = await getSupabase().rpc("set_driver_online", { p_online: online });
  if (error) throw error;
  return data;
}

export async function getMyDriver() {
  const { data: { user } } = await getSupabase().auth.getUser();
  if (!user) return null;
  const { data, error } = await getSupabase()
    .from("drivers")
    .select("*, vehicles(*), profiles:profile_id(full_name, phone)")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitDriverProfile(payload) {
  const { data, error } = await getSupabase().rpc("submit_driver_profile", payload);
  if (error) throw error;
  return data;
}

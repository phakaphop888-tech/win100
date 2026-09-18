import { getSupabase } from "../supabase.js";

export async function triggerSos(rideId, lat, lng) {
  const { data, error } = await getSupabase().rpc("create_sos", {
    p_ride_id: rideId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
  return data;
}

export async function listSos() {
  const { data, error } = await getSupabase()
    .from("sos_events")
    .select("*, profiles(full_name, phone), rides(status, pickup_address)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setSosStatus(id, status) {
  const patch = { status };
  if (status === "resolved") patch.resolved_at = new Date().toISOString();
  const { error } = await getSupabase().from("sos_events").update(patch).eq("id", id);
  if (error) throw error;
}

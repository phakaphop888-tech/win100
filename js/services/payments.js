import { getSupabase } from "../supabase.js";

export async function confirmCash(rideId) {
  const { data, error } = await getSupabase().rpc("driver_confirm_cash_paid", { p_ride_id: rideId });
  if (error) throw error;
  return data;
}

export async function listPayments() {
  const { data, error } = await getSupabase()
    .from("payments")
    .select("*, rides(pickup_address, dropoff_address, status)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

import { getSupabase } from "../supabase.js";

export async function submitRating(rideId, score, comment) {
  const { data, error } = await getSupabase().rpc("submit_rating", {
    p_ride_id: rideId,
    p_score: score,
    p_comment: comment,
  });
  if (error) throw error;
  return data;
}

import { getSupabase } from "../supabase.js";

export function subscribeChat(rideId, onInsert) {
  const ch = getSupabase()
    .channel(`chat:${rideId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `ride_id=eq.${rideId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => getSupabase().removeChannel(ch);
}

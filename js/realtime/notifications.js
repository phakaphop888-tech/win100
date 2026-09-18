import { getSupabase } from "../supabase.js";

export function subscribeNotifications(profileId, onInsert) {
  const ch = getSupabase()
    .channel(`notif:${profileId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${profileId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => getSupabase().removeChannel(ch);
}

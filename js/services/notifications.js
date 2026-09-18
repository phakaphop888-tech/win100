import { getSupabase } from "../supabase.js";

export async function listNotifications() {
  const { data, error } = await getSupabase()
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return data || [];
}

export async function unreadCount(profileId) {
  const { count, error } = await getSupabase()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("is_read", false);
  if (error) throw error;
  return count || 0;
}

export async function markRead(id) {
  const { error } = await getSupabase().from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllRead(profileId) {
  const { error } = await getSupabase()
    .from("notifications")
    .update({ is_read: true })
    .eq("profile_id", profileId)
    .eq("is_read", false);
  if (error) throw error;
}

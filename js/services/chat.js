import { getSupabase } from "../supabase.js";

export async function listMessages(rideId) {
  const { data, error } = await getSupabase()
    .from("chat_messages")
    .select("*")
    .eq("ride_id", rideId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendMessage(rideId, senderId, body) {
  const { data, error } = await getSupabase()
    .from("chat_messages")
    .insert({ ride_id: rideId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markChatRead(rideId, myId) {
  const { error } = await getSupabase()
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("ride_id", rideId)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;
}

export async function unreadChatCount(rideId, myId) {
  const { count, error } = await getSupabase()
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("ride_id", rideId)
    .neq("sender_id", myId)
    .is("read_at", null);
  if (error) throw error;
  return count || 0;
}

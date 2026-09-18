import { getSupabase } from "../supabase.js";

export async function createTicket(row) {
  const { data, error } = await getSupabase().from("support_tickets").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function myTickets(profileId) {
  const { data, error } = await getSupabase()
    .from("support_tickets")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function allTickets() {
  const { data, error } = await getSupabase()
    .from("support_tickets")
    .select("*, profiles(full_name, phone)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function replyTicket(id, admin_reply, status) {
  const { error } = await getSupabase()
    .from("support_tickets")
    .update({ admin_reply, status })
    .eq("id", id);
  if (error) throw error;
}

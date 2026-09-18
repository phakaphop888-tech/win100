import { getSupabase } from "../supabase.js";

export async function listFavorites() {
  const { data, error } = await getSupabase()
    .from("favorite_places")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addFavorite(row) {
  const { data, error } = await getSupabase().from("favorite_places").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function removeFavorite(id) {
  const { error } = await getSupabase().from("favorite_places").delete().eq("id", id);
  if (error) throw error;
}

import { getSupabase } from "./supabase.js";
import { tError } from "./utils.js";

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw Object.assign(error, { message: "not_authenticated" });
  return data;
}

export async function signUp({ email, password, fullName, phone, role }) {
  const safeRole = role === "driver" ? "driver" : "passenger";
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, role: safeRole },
    },
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(email) {
  const redirectTo = new URL("login.html", location.href).href;
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function signOut() {
  await getSupabase().auth.signOut();
}

export async function updateProfile(patch) {
  const user = await getUser();
  if (!user) throw new Error("not_authenticated");
  const { data, error } = await getSupabase()
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export { tError };

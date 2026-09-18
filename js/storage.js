import { getSupabase } from "./supabase.js";
import { getUser } from "./auth.js";

export async function uploadPrivate(bucket, file, folderParts = []) {
  const user = await getUser();
  if (!user) throw new Error("not_authenticated");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = [user.id, ...folderParts, `${crypto.randomUUID()}.${ext}`].join("/");
  const { error } = await getSupabase().storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function signedUrl(bucket, path, expires = 3600) {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from(bucket).createSignedUrl(path, expires);
  if (error) throw error;
  return data.signedUrl;
}

export function publicUrl(bucket, path) {
  if (!path) return null;
  const { data } = getSupabase().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

import { getSupabase } from "../supabase.js";

export async function adminLiveDrivers() {
  const { data, error } = await getSupabase().rpc("admin_live_drivers");
  if (error) throw error;
  return data || [];
}

export async function listDrivers(q = "") {
  let query = getSupabase()
    .from("drivers")
    .select("*, profiles:profile_id(full_name, phone, status), vehicles(*)")
    .order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  if (!q) return rows;
  const s = q.toLowerCase();
  return rows.filter((d) =>
    `${d.profiles?.full_name || ""} ${d.profiles?.phone || ""} ${d.vehicles?.plate_number || ""}`
      .toLowerCase()
      .includes(s)
  );
}

export async function getDriver(id) {
  const { data, error } = await getSupabase()
    .from("drivers")
    .select("*, profiles:profile_id(*), vehicles(*), driver_documents(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setDriverStatus(id, status, reason) {
  const { data, error } = await getSupabase().rpc("admin_set_driver_status", {
    p_driver_id: id,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function setAccountStatus(profileId, status) {
  const { data, error } = await getSupabase().rpc("admin_set_account_status", {
    p_profile_id: profileId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export async function listUsers() {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listJobs(status) {
  let q = getSupabase()
    .from("rides")
    .select("id, passenger_id, driver_id, pickup_address, dropoff_address, distance_km, fare_amount, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  const sb = getSupabase();
  return Promise.all(rows.map(async (r) => {
    const [{ data: passenger }, { data: driver }] = await Promise.all([
      sb.from("profiles").select("full_name, phone").eq("id", r.passenger_id).maybeSingle(),
      r.driver_id
        ? sb.from("drivers").select("id, profile_id").eq("id", r.driver_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    let dname = null;
    if (driver) {
      const { data: p } = await sb.from("profiles").select("full_name").eq("id", driver.profile_id).maybeSingle();
      dname = p;
    }
    return { ...r, passenger, driver: driver ? { ...driver, profiles: dname } : null };
  }));
}

export async function dashboardStats() {
  const sb = getSupabase();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const iso = start.toISOString();

  const [users, drivers, online, today, active, done, cancelled, paid] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("drivers").select("id", { count: "exact", head: true }),
    sb.from("drivers").select("id", { count: "exact", head: true }).eq("is_online", true),
    sb.from("rides").select("id", { count: "exact", head: true }).gte("created_at", iso),
    sb.from("rides").select("id", { count: "exact", head: true }).not("status", "in", "(TRIP_COMPLETED,CANCELLED)"),
    sb.from("rides").select("id", { count: "exact", head: true }).eq("status", "TRIP_COMPLETED").gte("created_at", iso),
    sb.from("rides").select("id", { count: "exact", head: true }).eq("status", "CANCELLED").gte("created_at", iso),
    sb.from("payments").select("amount").eq("status", "paid").gte("created_at", iso),
  ]);

  const revenue = (paid.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  return {
    users: users.count || 0,
    drivers: drivers.count || 0,
    online: online.count || 0,
    today: today.count || 0,
    active: active.count || 0,
    done: done.count || 0,
    cancelled: cancelled.count || 0,
    revenue,
  };
}

export async function reportStats() {
  const sb = getSupabase();
  const { data: rides, error } = await sb.from("rides").select("status, fare_amount, distance_km, created_at");
  if (error) throw error;
  const all = rides || [];
  const completed = all.filter((r) => r.status === "TRIP_COMPLETED");
  const cancelled = all.filter((r) => r.status === "CANCELLED");
  const avg = (arr, key) => (arr.length ? arr.reduce((s, r) => s + Number(r[key] || 0), 0) / arr.length : 0);
  const { data: ratings } = await sb.from("ratings").select("score");
  const { count: online } = await sb.from("drivers").select("id", { count: "exact", head: true }).eq("is_online", true);
  return {
    trips: all.length,
    completed: completed.length,
    cancelled: cancelled.length,
    revenue: completed.reduce((s, r) => s + Number(r.fare_amount || 0), 0),
    avgFare: avg(completed, "fare_amount"),
    avgDistance: avg(completed, "distance_km"),
    avgRating: ratings?.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : 0,
    online: online || 0,
  };
}

export async function listReviews() {
  const { data, error } = await getSupabase()
    .from("ratings")
    .select("*, rides(pickup_address, dropoff_address), profiles:from_profile_id(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAudit() {
  const { data, error } = await getSupabase()
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function listStands() {
  const { data, error } = await getSupabase().from("win_stands").select("*").order("name");
  if (error) throw error;
  return data || [];
}

export async function saveStand(row) {
  const sb = getSupabase();
  const q = row.id
    ? sb.from("win_stands").update(row).eq("id", row.id)
    : sb.from("win_stands").insert(row);
  const { error } = await q;
  if (error) throw error;
}

export async function nearbyStands(lat, lng) {
  const { data, error } = await getSupabase().rpc("nearby_win_stands", {
    p_lat: lat,
    p_lng: lng,
    p_limit: 8,
  });
  if (error) throw error;
  return data || [];
}

export async function updateSettings(payload) {
  const { data, error } = await getSupabase().rpc("admin_update_settings", payload);
  if (error) throw error;
  return data;
}

export async function broadcastNotification(title, body) {
  const { data: profiles, error } = await getSupabase().from("profiles").select("id");
  if (error) throw error;
  const rows = (profiles || []).map((p) => ({ profile_id: p.id, title, body, type: "admin" }));
  if (!rows.length) return;
  const { error: e2 } = await getSupabase().from("notifications").insert(rows);
  if (e2) throw e2;
}

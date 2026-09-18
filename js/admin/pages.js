import { requireAuth } from "../guards.js";
import { adminSidebar, brandLockup, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { dashboardStats, listDrivers, setDriverStatus, getDriver, listUsers, setAccountStatus, listJobs, reportStats, listReviews, listAudit, listStands, saveStand, adminLiveDrivers, updateSettings, broadcastNotification } from "../services/admin.js";
import { listPayments } from "../services/payments.js";
import { allTickets, replyTicket } from "../services/support.js";
import { listSos, setSosStatus } from "../services/sos.js";
import { listNotifications } from "../services/notifications.js";
import { fetchRide, fetchHistoryTimeline } from "../services/rides.js";
import { getSettings } from "../services/rides.js";
import { createMap, setMarker, drawRoute, divIcon } from "../map/map.js";
import { osrmRoute } from "../map/osrm.js";
import { subscribeAllLocations } from "../realtime/locations.js";
import { qs, formatBaht, formatTime, rideStatusLabel, showToast, tError, go, renderState, formatKm } from "../utils.js";
import { skeletonCards } from "../components/ui.js";
import { signedUrl } from "../storage.js";

function shell(active, body) {
  return `${renderOfflineBanner()}
  <div class="admin-shell min-h-[100dvh]">
    ${adminSidebar(active)}
    <main class="min-w-0">
      <div class="topbar lg:hidden">${brandLockup()}<span class="font-bold">Admin</span><a href="./index.html" class="icon-btn"><i data-lucide="menu"></i></a></div>
      <div class="p-4 lg:p-8">${body}</div>
    </main>
  </div>`;
}

async function boot(active, title, render) {
  const profile = await requireAuth("admin");
  if (!profile) return;
  document.body.innerHTML = shell(active, `<h1 class="text-2xl font-bold mb-4">${title}</h1><div id="root">${skeletonCards(3)}</div>`);
  bindChrome("admin");
  try {
    await render(document.getElementById("root"), profile);
  } catch (e) {
    renderState(document.getElementById("root"), "error", tError(e));
  }
}

export async function bootAdminHome() {
  await boot("index.html", "Dashboard", async (root) => {
    const s = await dashboardStats();
    const cards = [
      ["ผู้ใช้งานทั้งหมด", s.users],
      ["คนขับทั้งหมด", s.drivers],
      ["คนขับ Online", s.online],
      ["งานวันนี้", s.today],
      ["งานกำลังดำเนินการ", s.active],
      ["งานสำเร็จ", s.done],
      ["งานยกเลิก", s.cancelled],
      ["รายได้วันนี้", formatBaht(s.revenue)],
    ];
    root.innerHTML = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${cards
      .map(([l, v]) => `<div class="card p-4"><p class="text-sm text-[var(--muted)]">${l}</p><p class="text-2xl font-extrabold mt-1">${v}</p></div>`)
      .join("")}</div>`;
  });
}

export async function bootAdminMap() {
  await boot("map.html", "Live Map", async (root) => {
    root.innerHTML = `<div id="map" class="app-map rounded-2xl h-[70vh]"></div><div id="legend" class="mt-3 text-sm text-[var(--muted)]"></div>`;
    const map = createMap(document.getElementById("map"));
    const markers = new Map();
    const paint = async () => {
      const rows = await adminLiveDrivers();
      document.getElementById("legend").textContent = `${rows.filter((r) => r.is_online).length} online`;
      rows.forEach((d) => {
        if (d.latitude == null) return;
        const color = !d.is_online ? "#8a8178" : d.gps_stale ? "#c2410c" : d.is_busy ? "#d4a017" : "#15803d";
        const m = setMarker(map, markers.get(d.driver_id), [d.latitude, d.longitude], divIcon(color));
        m.bindPopup(`${d.full_name}<br>${d.is_online ? "Online" : "Offline"} ${d.is_busy ? "Busy" : ""} ${d.gps_stale ? "GPS Stale" : ""}<br>★ ${Number(d.rating_avg).toFixed(1)} · ${d.plate_number || ""}<br>GPS ${d.gps_updated_at ? formatTime(d.gps_updated_at) : "-"}<br>งาน ${d.current_ride_id || "-"}`);
        markers.set(d.driver_id, m);
      });
    };
    await paint();
    subscribeAllLocations(paint);
  });
}

export async function bootAdminDrivers() {
  await boot("drivers.html", "Drivers", async (root) => {
    const q = qs("q") || "";
    const rows = await listDrivers(q);
    root.innerHTML = `<form class="mb-4"><input name="q" value="${q}" class="h-12 rounded-xl border border-[var(--line)] px-3 bg-[var(--bg)] w-full max-w-sm" placeholder="ค้นหาชื่อ เบอร์ ทะเบียน" /></form>
      <div class="table-wrap card"><table class="data"><thead><tr><th>ชื่อ</th><th>สถานะ</th><th>Online</th><th>คะแนน</th></tr></thead><tbody>
      ${rows.map((d) => `<tr><td><a href="./driver.html?id=${d.id}">${d.profiles?.full_name || "-"}</a></td><td>${d.verification_status}</td><td>${d.is_online ? "Yes" : "No"}</td><td>${Number(d.rating_avg).toFixed(1)}</td></tr>`).join("")}
      </tbody></table></div>`;
  });
}

export async function bootAdminDriver() {
  await boot("drivers.html", "Driver Detail", async (root) => {
    const d = await getDriver(qs("id"));
    if (!d) return renderState(root, "empty", "ไม่พบคนขับ");
    const docs = await Promise.all((d.driver_documents || []).map(async (doc) => ({
      ...doc,
      url: await signedUrl("driver-documents", doc.storage_path).catch(() => null),
    })));
    root.innerHTML = `<div class="card p-5 max-w-2xl">
      <p class="text-xl font-bold">${d.profiles?.full_name}</p>
      <p class="text-sm">${d.profiles?.phone} · ${d.verification_status}</p>
      <p class="text-sm mt-2">${d.vehicles?.brand} ${d.vehicles?.model} ${d.vehicles?.color} · ${d.vehicles?.plate_number}</p>
      <div class="flex flex-wrap gap-2 mt-4">
        ${docs.map((x) => x.url ? `<a class="btn btn-ghost btn-sm" target="_blank" href="${x.url}">${x.doc_type}</a>` : "").join("")}
      </div>
      <div class="grid grid-cols-2 gap-2 mt-4">
        <button data-s="approved" class="btn btn-primary act">Approve</button>
        <button data-s="rejected" class="btn btn-ghost act">Reject</button>
        <button data-s="suspended" class="btn btn-danger act">Suspend</button>
        <button data-s="pending" class="btn btn-ghost act">Restore pending</button>
      </div>
    </div>`;
    root.querySelectorAll(".act").forEach((b) => b.addEventListener("click", async () => {
      try {
        const reason = b.dataset.s === "rejected" ? prompt("เหตุผล") : null;
        await setDriverStatus(d.id, b.dataset.s, reason);
        showToast("บันทึกแล้ว");
        location.reload();
      } catch (e) { showToast(tError(e), "error"); }
    }));
  });
}

export async function bootAdminUsers() {
  await boot("users.html", "Users", async (root) => {
    const rows = await listUsers();
    root.innerHTML = `<div class="table-wrap card"><table class="data"><thead><tr><th>ชื่อ</th><th>บทบาท</th><th>สถานะ</th><th></th></tr></thead><tbody>
      ${rows.map((u) => `<tr><td>${u.full_name || "-"}</td><td>${u.role}</td><td>${u.status}</td><td>
        <button class="btn btn-sm btn-ghost" data-id="${u.id}" data-s="${u.status === "active" ? "suspended" : "active"}">${u.status === "active" ? "Suspend" : "Restore"}</button>
      </td></tr>`).join("")}</tbody></table></div>`;
    root.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", async () => {
      try { await setAccountStatus(b.dataset.id, b.dataset.s); location.reload(); } catch (e) { showToast(tError(e), "error"); }
    }));
  });
}

export async function bootAdminJobs() {
  await boot("jobs.html", "Jobs", async (root) => {
    const status = qs("status") || "";
    const rows = await listJobs(status || undefined);
    root.innerHTML = `<div class="flex gap-2 overflow-auto mb-3">${["", "SEARCHING", "DRIVER_EN_ROUTE", "TRIP_STARTED", "TRIP_COMPLETED", "CANCELLED"].map((s) => `<a class="btn btn-sm ${status===s?"btn-primary":"btn-ghost"}" href="./jobs.html${s?`?status=${s}`:""}">${s||"ทั้งหมด"}</a>`).join("")}</div>
      <div class="table-wrap card"><table class="data"><thead><tr><th>Ride</th><th>ผู้โดยสาร</th><th>คนขับ</th><th>ค่าโดยสาร</th><th>สถานะ</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><a href="./job.html?id=${r.id}">${r.id.slice(0,8)}</a></td><td>${r.passenger?.full_name || "-"}</td><td>${r.driver?.profiles?.full_name || "-"}</td><td>${formatBaht(r.fare_amount)}</td><td>${rideStatusLabel(r.status)}</td></tr>`).join("")}
      </tbody></table></div>`;
  });
}

export async function bootAdminJob() {
  await boot("jobs.html", "Job Detail", async (root) => {
    const ride = await fetchRide(qs("id"));
    if (!ride) return renderState(root, "empty", "ไม่พบงาน");
    const timeline = await fetchHistoryTimeline(ride.id);
    root.innerHTML = `<div class="grid lg:grid-cols-2 gap-4">
      <div id="map" class="app-map rounded-2xl h-80"></div>
      <div class="card p-4 space-y-2 text-sm">
        <p>${rideStatusLabel(ride.status)}</p>
        <p>ผู้โดยสาร: ${ride.passenger?.full_name}</p>
        <p>คนขับ: ${ride.driver?.profiles?.full_name || "-"}</p>
        <p>จุดรับ: ${ride.pickup_address}</p>
        <p>จุดส่ง: ${ride.dropoff_address}</p>
        <p>${formatKm(ride.distance_km)} · ${formatBaht(ride.fare_amount)}</p>
        <p>ชำระเงิน: ${ride.payments[0]?.method || "-"} / ${ride.payments[0]?.status || "-"}</p>
        <p>คะแนน: ${ride.ratings[0]?.score || "-"}</p>
        <p>ยกเลิก: ${ride.cancel_reason || "-"}</p>
      </div>
    </div>
    <ol class="mt-4 card p-4">${timeline.map((h) => `<li class="text-sm py-1">${formatTime(h.created_at)} · ${h.from_status || "-"} → ${h.to_status}</li>`).join("")}</ol>`;
    const map = createMap(document.getElementById("map"));
    setMarker(map, null, [ride.pickup_lat, ride.pickup_lng], divIcon("#d4a017"));
    setMarker(map, null, [ride.dropoff_lat, ride.dropoff_lng], divIcon("#121110"));
    try {
      const route = await osrmRoute({ lat: ride.pickup_lat, lng: ride.pickup_lng }, { lat: ride.dropoff_lat, lng: ride.dropoff_lng });
      drawRoute(map, null, route.coords);
    } catch { /* ignore */ }
  });
}

export async function bootAdminPayments() {
  await boot("payments.html", "Payments", async (root) => {
    const rows = await listPayments();
    root.innerHTML = `<div class="table-wrap card"><table class="data"><thead><tr><th>Ride</th><th>ยอด</th><th>วิธี</th><th>สถานะ</th><th>วันที่</th></tr></thead><tbody>
      ${rows.map((p) => `<tr><td>${p.ride_id.slice(0,8)}</td><td>${formatBaht(p.amount)}</td><td>${p.method}</td><td>${p.status}</td><td>${formatTime(p.created_at)}</td></tr>`).join("")}</tbody></table></div>`;
  });
}

export async function bootAdminReviews() {
  await boot("reviews.html", "Reviews", async (root) => {
    const rows = await listReviews();
    root.innerHTML = rows.map((r) => `<article class="card p-4 mb-3"><p class="font-bold">${r.score} ดาว</p><p class="text-sm">${r.comment || ""}</p><p class="text-xs">${r.profiles?.full_name || ""} · ${formatTime(r.created_at)}</p></article>`).join("") || `<p>ยังไม่มีรีวิว</p>`;
  });
}

export async function bootAdminReports() {
  await boot("reports.html", "Reports", async (root) => {
    const s = await reportStats();
    const items = [
      ["Trips", s.trips],
      ["Revenue", formatBaht(s.revenue)],
      ["Completed", s.completed],
      ["Cancelled", s.cancelled],
      ["Average Fare", formatBaht(s.avgFare)],
      ["Average Distance", formatKm(s.avgDistance)],
      ["Average Rating", s.avgRating.toFixed(2)],
      ["Online Drivers", s.online],
    ];
    root.innerHTML = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${items.map(([l,v]) => `<div class="card p-4"><p class="text-sm text-[var(--muted)]">${l}</p><p class="text-2xl font-extrabold">${v}</p></div>`).join("")}</div>`;
  });
}

export async function bootAdminNotifications() {
  await boot("notifications.html", "Notifications", async (root, profile) => {
    root.innerHTML = `<form id="f" class="card p-4 max-w-xl space-y-3 mb-4">
      <div class="field"><label>หัวข้อ</label><input name="title" required /></div>
      <div class="field"><label>ข้อความ</label><textarea name="body" required></textarea></div>
      <button class="btn btn-primary">ส่งถึงผู้ใช้ทั้งหมด</button>
    </form><div id="list"></div>`;
    const rows = await listNotifications();
    document.getElementById("list").innerHTML = rows.map((n) => `<article class="card p-3 mb-2"><p class="font-semibold">${n.title}</p><p class="text-sm">${n.body}</p></article>`).join("");
    document.getElementById("f").onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        await broadcastNotification(fd.get("title"), fd.get("body"));
        showToast("ส่งแล้ว");
      } catch (e) { showToast(tError(e), "error"); }
    };
  });
}

export async function bootAdminSupport() {
  await boot("support.html", "Support", async (root) => {
    const rows = await allTickets();
    root.innerHTML = rows.map((t) => `<article class="card p-4 mb-3">
      <p class="font-bold">${t.subject} · ${t.status}</p>
      <p class="text-sm">${t.message}</p>
      <form data-id="${t.id}" class="mt-2 flex gap-2">
        <input name="reply" class="flex-1 rounded-xl border px-2" value="${t.admin_reply || ""}" />
        <select name="status"><option>open</option><option>in_progress</option><option>resolved</option><option>closed</option></select>
        <button class="btn btn-primary btn-sm">บันทึก</button>
      </form>
    </article>`).join("");
    root.querySelectorAll("form[data-id]").forEach((f) => {
      f.querySelector('[name=status]').value = f.closest("article") ? f.status?.value : "open";
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        const fd = new FormData(f);
        try { await replyTicket(f.dataset.id, fd.get("reply"), fd.get("status")); showToast("บันทึกแล้ว"); } catch (e) { showToast(tError(e), "error"); }
      };
    });
  });
}

export async function bootAdminAudit() {
  await boot("audit.html", "Audit Logs", async (root) => {
    const rows = await listAudit();
    root.innerHTML = `<div class="table-wrap card"><table class="data"><thead><tr><th>เวลา</th><th>Action</th><th>Entity</th></tr></thead><tbody>
      ${rows.map((a) => `<tr><td>${formatTime(a.created_at)}</td><td>${a.action}</td><td>${a.entity_type}</td></tr>`).join("")}</tbody></table></div>`;
  });
}

export async function bootAdminStands() {
  await boot("stands.html", "Win Stands", async (root) => {
    const rows = await listStands();
    root.innerHTML = `<form id="f" class="card p-4 grid md:grid-cols-2 gap-3 mb-4 max-w-3xl">
      <input name="name" placeholder="ชื่อวิน" required class="h-12 rounded-xl border px-3" />
      <input name="address" placeholder="ที่อยู่" class="h-12 rounded-xl border px-3" />
      <input name="latitude" placeholder="lat" required class="h-12 rounded-xl border px-3" />
      <input name="longitude" placeholder="lng" required class="h-12 rounded-xl border px-3" />
      <button class="btn btn-primary md:col-span-2">เพิ่มจุดวิน</button>
    </form>${rows.map((s) => `<div class="card p-3 mb-2">${s.name} · ${s.address} · ${s.is_active ? "เปิด" : "ปิด"}</div>`).join("")}`;
    document.getElementById("f").onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        await saveStand({
          name: fd.get("name"),
          address: fd.get("address"),
          latitude: Number(fd.get("latitude")),
          longitude: Number(fd.get("longitude")),
          is_active: true,
        });
        location.reload();
      } catch (e) { showToast(tError(e), "error"); }
    };
  });
}

export async function bootAdminSos() {
  await boot("sos.html", "SOS", async (root) => {
    const rows = await listSos();
    root.innerHTML = rows.map((s) => `<article class="card p-4 mb-3">
      <p class="font-bold">${s.status} · ${s.profiles?.full_name || ""}</p>
      <p class="text-sm">${formatTime(s.created_at)} · ${s.latitude}, ${s.longitude}</p>
      ${s.status !== "resolved" ? `<button data-id="${s.id}" class="btn btn-primary btn-sm mt-2">Resolved</button>` : ""}
    </article>`).join("") || `<p>ไม่มีเหตุการณ์</p>`;
    root.querySelectorAll("button[data-id]").forEach((b) => b.onclick = async () => {
      await setSosStatus(b.dataset.id, "resolved");
      location.reload();
    });
  });
}

export async function bootAdminSettings() {
  await boot("settings.html", "Settings", async (root) => {
    const s = await getSettings();
    root.innerHTML = `<form id="f" class="card p-5 max-w-xl space-y-3">
      <div class="field"><label>Base fare</label><input name="base" type="number" value="${s.base_fare}" /></div>
      <div class="field"><label>Price / km</label><input name="km" type="number" value="${s.price_per_km}" /></div>
      <div class="field"><label>Min fare</label><input name="min" type="number" value="${s.min_fare}" /></div>
      <div class="field"><label>Match radius km</label><input name="radius" type="number" value="${s.match_radius_km}" /></div>
      <div class="field"><label>GPS stale seconds</label><input name="stale" type="number" value="${s.gps_stale_seconds}" /></div>
      <div class="field"><label>Search timeout seconds</label><input name="timeout" type="number" value="${s.search_timeout_seconds}" /></div>
      <button class="btn btn-primary">บันทึก</button>
    </form>`;
    document.getElementById("f").onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      try {
        await updateSettings({
          p_base_fare: Number(fd.get("base")),
          p_price_per_km: Number(fd.get("km")),
          p_min_fare: Number(fd.get("min")),
          p_match_radius_km: Number(fd.get("radius")),
          p_gps_stale_seconds: Number(fd.get("stale")),
          p_search_timeout_seconds: Number(fd.get("timeout")),
        });
        showToast("บันทึกแล้ว");
      } catch (e) { showToast(tError(e), "error"); }
    };
  });
}

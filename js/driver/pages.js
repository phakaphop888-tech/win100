import { bootListPage } from "../passenger/history.js";
import { driverNav } from "../components/nav.js";
import { fetchRideHistory } from "../services/rides.js";
import { getMyDriver } from "../services/drivers.js";
import { formatBaht, formatTime, rideStatusLabel } from "../utils.js";
import { requireAuth } from "../guards.js";
import { brandLockup, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { submitDriverProfile, getMyDriver as loadDriver } from "../services/drivers.js";
import { uploadPrivate } from "../storage.js";
import { getSupabase } from "../supabase.js";
import { showToast, tError } from "../utils.js";

export async function bootDriverJobs() {
  await bootListPage({
    role: "driver",
    nav: driverNav("jobs.html"),
    title: "งาน",
    load: fetchRideHistory,
    row: (r) => `<a class="card p-4 mb-3 block" href="./job.html?id=${r.id}">
      <div class="flex justify-between"><strong>${rideStatusLabel(r.status)}</strong><span>${formatBaht(r.fare_amount)}</span></div>
      <p class="text-sm text-[var(--muted)]">${r.pickup_address} → ${r.dropoff_address}</p>
      <p class="text-xs">${formatTime(r.created_at)}</p>
    </a>`,
  });
}

export async function bootDriverHistory() {
  await bootDriverJobs();
}

export async function bootDriverEarnings() {
  const profile = await requireAuth("driver");
  if (!profile) return;
  const driver = await getMyDriver();
  const rows = (await fetchRideHistory()).filter((r) => r.status === "TRIP_COMPLETED");
  const sum = rows.reduce((s, r) => s + Number(r.fare_amount || 0), 0);
  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="max-w-lg mx-auto safe-bottom">
      <div class="topbar">${brandLockup()}<h1 class="font-bold">รายได้</h1><span></span></div>
      <div class="px-4">
        <div class="card p-5 mb-4"><p class="text-sm text-[var(--muted)]">รายได้สะสมจากงานที่สำเร็จ</p><p class="text-3xl font-extrabold">${formatBaht(sum)}</p><p class="text-sm mt-2">คะแนนเฉลี่ย ${Number(driver?.rating_avg || 0).toFixed(1)} (${driver?.rating_count || 0})</p></div>
        ${rows.map((r) => `<div class="card p-3 mb-2 flex justify-between"><span>${formatTime(r.created_at)}</span><strong>${formatBaht(r.fare_amount)}</strong></div>`).join("") || `<p class="text-sm text-[var(--muted)]">ยังไม่มีรายได้</p>`}
      </div>
    </div>
    ${driverNav("earnings.html")}`;
  bindChrome("driver");
}

export async function bootVerification() {
  const profile = await requireAuth("driver");
  if (!profile) return;
  const driver = await loadDriver();
  const v = driver?.vehicles || {};
  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="max-w-lg mx-auto safe-bottom">
      <div class="topbar">${brandLockup()}<h1 class="font-bold">ยืนยันตัวตน</h1><span></span></div>
      <p class="px-4 text-sm mb-3">สถานะ: <strong>${driver?.verification_status || "pending"}</strong></p>
      <form id="form" class="px-4 space-y-3">
        <div class="field"><label>ชื่อ</label><input value="${profile.full_name || ""}" disabled /></div>
        <div class="field"><label>เบอร์</label><input value="${profile.phone || ""}" disabled /></div>
        <div class="field"><label>ยี่ห้อรถ</label><input name="brand" value="${v.brand || ""}" required /></div>
        <div class="field"><label>รุ่น</label><input name="model" value="${v.model || ""}" required /></div>
        <div class="field"><label>สี</label><input name="color" value="${v.color || ""}" required /></div>
        <div class="field"><label>ทะเบียน</label><input name="plate" value="${v.plate_number || ""}" required /></div>
        <div class="field"><label>เลขท้ายบัตรประชาชน 4 หลัก</label><input name="nid" maxlength="4" value="${driver?.national_id_last4 || ""}" required /></div>
        <div class="field"><label>บัตรประชาชน</label><input type="file" name="national_id" accept="image/*" /></div>
        <div class="field"><label>เซลฟี</label><input type="file" name="selfie" accept="image/*" /></div>
        <div class="field"><label>เอกสารรถ</label><input type="file" name="vehicle_registration" accept="image/*" /></div>
        <button class="btn btn-primary">ส่งเอกสาร</button>
      </form>
    </div>
    ${driverNav("profile.html")}`;
  bindChrome("driver");
  document.getElementById("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await submitDriverProfile({
        p_brand: fd.get("brand"),
        p_model: fd.get("model"),
        p_color: fd.get("color"),
        p_plate: fd.get("plate"),
        p_national_id_last4: fd.get("nid"),
      });
      const types = ["national_id", "selfie", "vehicle_registration"];
      for (const t of types) {
        const file = fd.get(t);
        if (file && file.size) {
          const path = await uploadPrivate("driver-documents", file, [t]);
          await getSupabase().from("driver_documents").insert({
            driver_id: driver.id,
            doc_type: t,
            storage_path: path,
            mime_type: file.type,
          });
        }
      }
      showToast("ส่งข้อมูลแล้ว รอการตรวจสอบ");
    } catch (e) {
      showToast(tError(e), "error");
    }
  });
}

import { requireAuth } from "../guards.js";
import { brandLockup, driverNav, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { createMap, setMarker, divIcon } from "../map/map.js";
import { watchGps } from "../map/gps.js";
import { getMyDriver, sendDriverGps, setOnline } from "../services/drivers.js";
import { fetchActiveRideForDriver, fetchRideHistory } from "../services/rides.js";
import { subscribeDriverRides } from "../realtime/rides.js";
import { formatBaht, go, showToast, tError, initIcons } from "../utils.js";

export async function bootDriverHome() {
  const profile = await requireAuth("driver");
  if (!profile) return;
  let driver = await getMyDriver();
  if (!driver) {
    showToast("ยังไม่มีข้อมูลคนขับ", "error");
    return go("./verification.html");
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const history = await fetchRideHistory().catch(() => []);
  const today = history.filter((r) => new Date(r.created_at) >= start && r.status === "TRIP_COMPLETED");
  const earned = today.reduce((s, r) => s + Number(r.fare_amount || 0), 0);

  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="relative h-[100dvh]">
      <div id="map" class="absolute inset-0 app-map"></div>
      <div class="absolute top-0 left-0 right-0 z-10 p-3">
        <div class="card p-4">
          <div class="flex justify-between items-start">
            ${brandLockup()}
            <span class="text-sm">★ ${Number(driver.rating_avg).toFixed(1)}</span>
          </div>
          <p class="font-bold mt-2">${profile.full_name || "คนขับ"}</p>
          <p class="text-xs text-[var(--muted)] mb-3">${driver.verification_status === "approved" ? "พร้อมรับงานเมื่อออนไลน์" : "รออนุมัติ — ยังออนไลน์ไม่ได้"}</p>
          <button id="onlineBtn" class="btn ${driver.is_online ? "btn-primary" : "btn-ghost"} w-full text-xl tracking-wide">
            ${driver.is_online ? "ONLINE" : "OFFLINE"}
          </button>
          <div class="grid grid-cols-3 gap-2 mt-3 text-center">
            <div><p class="text-xs text-[var(--muted)]">รายได้วันนี้</p><p class="font-bold">${formatBaht(earned)}</p></div>
            <div><p class="text-xs text-[var(--muted)]">งานวันนี้</p><p class="font-bold">${today.length}</p></div>
            <div><p class="text-xs text-[var(--muted)]">คะแนน</p><p class="font-bold">${Number(driver.rating_avg).toFixed(1)}</p></div>
          </div>
        </div>
      </div>
      <div id="job" class="absolute left-0 right-0 bottom-0 z-10 safe-bottom px-3"></div>
      ${driverNav("index.html")}
    </div>`;
  bindChrome("driver");
  initIcons();

  const map = createMap(document.getElementById("map"));
  let me = null;
  let stopGps = () => {};

  const startTracking = () => {
    stopGps();
    stopGps = watchGps({
      onChange: async (pos) => {
        me = setMarker(map, me, [pos.lat, pos.lng], divIcon("#d4a017"));
        try {
          await sendDriverGps(pos);
        } catch (e) {
          if (e.message !== "driver_not_eligible") showToast(tError(e), "error");
        }
      },
      onError: () => showToast("ไม่สามารถระบุตำแหน่งได้", "error"),
    });
  };

  if (driver.is_online) startTracking();

  async function paintJob() {
    const ride = await fetchActiveRideForDriver(driver.id);
    const el = document.getElementById("job");
    if (!ride) {
      el.innerHTML = "";
      return;
    }
    if (ride.status === "DRIVER_ASSIGNED") {
      el.innerHTML = `<section class="sheet">
        <div class="sheet-handle"></div>
        <p class="text-center font-bold text-lg">มีงานใหม่</p>
        <p class="text-sm mt-3"><span class="text-[var(--muted)]">จุดรับ</span><br>${ride.pickup_address}</p>
        <p class="text-sm mt-2"><span class="text-[var(--muted)]">จุดส่ง</span><br>${ride.dropoff_address}</p>
        <div class="flex justify-between mt-3 font-semibold"><span>${Number(ride.distance_km).toFixed(1)} km</span><span>~${Math.round(ride.duration_min)} นาที</span></div>
        <p class="text-center text-2xl font-extrabold my-3">${formatBaht(ride.fare_amount)}</p>
        <div class="grid grid-cols-2 gap-2">
          <button id="rej" class="btn btn-ghost">ปฏิเสธ</button>
          <button id="acc" class="btn btn-primary">รับงาน</button>
        </div>
      </section>`;
      const { acceptRide, rejectRide } = await import("../services/rides.js");
      document.getElementById("acc").onclick = async () => {
        try {
          await acceptRide(ride.id);
          go(`./job.html?id=${ride.id}`);
        } catch (e) {
          showToast(tError(e.message === "job_taken" ? "job_taken" : e), "error");
        }
      };
      document.getElementById("rej").onclick = async () => {
        try {
          await rejectRide(ride.id);
          paintJob();
        } catch (e) {
          showToast(tError(e), "error");
        }
      };
      return;
    }
    go(`./job.html?id=${ride.id}`);
  }

  document.getElementById("onlineBtn").addEventListener("click", async () => {
    try {
      driver = await setOnline(!driver.is_online);
      document.getElementById("onlineBtn").textContent = driver.is_online ? "ONLINE" : "OFFLINE";
      document.getElementById("onlineBtn").className = `btn ${driver.is_online ? "btn-primary" : "btn-ghost"} w-full text-xl tracking-wide`;
      if (driver.is_online) startTracking();
      else stopGps();
    } catch (e) {
      showToast(tError(e), "error");
    }
  });

  subscribeDriverRides(driver.id, paintJob);
  paintJob();
}

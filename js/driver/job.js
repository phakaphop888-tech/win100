import { requireAuth } from "../guards.js";
import { brandLockup, driverNav, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { createMap, setMarker, drawRoute, divIcon } from "../map/map.js";
import { osrmRoute } from "../map/osrm.js";
import { fetchRide, updateRideStatus, cancelRide } from "../services/rides.js";
import { confirmCash } from "../services/payments.js";
import { triggerSos } from "../services/sos.js";
import { subscribeRide } from "../realtime/rides.js";
import { qs, formatBaht, rideStatusLabel, showToast, tError, go, initIcons } from "../utils.js";

const nextOf = {
  DRIVER_EN_ROUTE: ["DRIVER_ARRIVED", "ถึงจุดรับแล้ว"],
  DRIVER_ARRIVED: ["TRIP_STARTED", "เริ่มเดินทาง"],
  TRIP_STARTED: ["TRIP_COMPLETED", "จบงาน"],
};

export async function bootDriverJob() {
  const profile = await requireAuth("driver");
  if (!profile) return;
  const id = qs("id");
  if (!id) return go("./jobs.html");

  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="relative h-[100dvh]">
      <div id="map" class="absolute inset-0 app-map"></div>
      <div class="absolute top-3 left-3 z-10">${brandLockup()}</div>
      <div class="absolute left-0 right-0 bottom-0 z-10 safe-bottom px-3">
        <section class="sheet" id="panel"></section>
      </div>
      ${driverNav("jobs.html")}
    </div>`;
  bindChrome("driver");
  const map = createMap(document.getElementById("map"));
  let layer = null;

  async function paint() {
    const ride = await fetchRide(id);
    if (!ride) return go("./index.html");
    setMarker(map, null, [ride.pickup_lat, ride.pickup_lng], divIcon("#d4a017"));
    setMarker(map, null, [ride.dropoff_lat, ride.dropoff_lng], divIcon("#121110"));
    try {
      const route = await osrmRoute(
        { lat: ride.pickup_lat, lng: ride.pickup_lng },
        { lat: ride.dropoff_lat, lng: ride.dropoff_lng }
      );
      layer = drawRoute(map, layer, route.coords);
    } catch { /* ignore */ }
    const nxt = nextOf[ride.status];
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${ride.status === "TRIP_STARTED" ? `${ride.dropoff_lat},${ride.dropoff_lng}` : `${ride.pickup_lat},${ride.pickup_lng}`}`;
    document.getElementById("panel").innerHTML = `
      <div class="sheet-handle"></div>
      <p class="status-pill bg-brand-100 text-ink-900">${rideStatusLabel(ride.status)}</p>
      <p class="mt-3 text-sm">ผู้โดยสาร: ${ride.passenger?.full_name || "-"}</p>
      <p class="text-sm mt-2">จุดรับ: ${ride.pickup_address}</p>
      <p class="text-sm mb-3">จุดส่ง: ${ride.dropoff_address}</p>
      <p class="font-bold mb-3">${formatBaht(ride.fare_amount)}</p>
      <div class="grid grid-cols-2 gap-2">
        <a class="btn btn-ghost" target="_blank" rel="noreferrer" href="${mapsUrl}">เปิดแผนที่</a>
        <a class="btn btn-ghost" href="./chat.html?id=${ride.id}">แชท</a>
      </div>
      ${nxt ? `<button id="next" class="btn btn-primary mt-3">${nxt[1]}</button>` : ""}
      ${ride.status === "TRIP_COMPLETED" ? `<button id="cash" class="btn btn-primary mt-3">ยืนยันรับเงินสด</button>` : ""}
      ${ride.status !== "TRIP_COMPLETED" && ride.status !== "CANCELLED" ? `<div class="grid grid-cols-2 gap-2 mt-3"><button id="sos" class="btn btn-danger">SOS</button><button id="cancel" class="btn btn-ghost">ยกเลิก</button></div>` : ""}
    `;
    initIcons();
    document.getElementById("next")?.addEventListener("click", async () => {
      try {
        await updateRideStatus(ride.id, nxt[0]);
      } catch (e) {
        showToast(tError(e), "error");
      }
    });
    document.getElementById("cash")?.addEventListener("click", async () => {
      try {
        await confirmCash(ride.id);
        showToast("บันทึกการชำระเงินแล้ว");
      } catch (e) {
        showToast(tError(e), "error");
      }
    });
    document.getElementById("sos")?.addEventListener("click", async () => {
      try {
        await triggerSos(ride.id, ride.pickup_lat, ride.pickup_lng);
        showToast("ส่ง SOS แล้ว");
      } catch (e) {
        showToast(tError(e), "error");
      }
    });
    document.getElementById("cancel")?.addEventListener("click", async () => {
      try { await cancelRide(ride.id, "driver_cancel"); } catch (e) { showToast(tError(e), "error"); }
    });
  }
  await paint();
  subscribeRide(id, paint);
}

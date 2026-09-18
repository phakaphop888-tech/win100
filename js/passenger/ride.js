import { requireAuth } from "../guards.js";
import { brandLockup, passengerNav, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { createMap, setMarker, drawRoute, divIcon } from "../map/map.js";
import { osrmRoute } from "../map/osrm.js";
import { fetchRide, cancelRide } from "../services/rides.js";
import { getSupabase } from "../supabase.js";
import { triggerSos } from "../services/sos.js";
import { submitRating } from "../services/ratings.js";
import { subscribeRide } from "../realtime/rides.js";
import { subscribeDriverLocation } from "../realtime/locations.js";
import { qs, formatBaht, formatKm, rideStatusLabel, showToast, tError, go, initIcons } from "../utils.js";

export async function bootPassengerRide() {
  const profile = await requireAuth("passenger");
  if (!profile) return;
  const id = qs("id");
  if (!id) return go("./index.html");

  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="relative h-[100dvh]">
      <div id="map" class="absolute inset-0 app-map"></div>
      <div class="absolute top-0 left-0 right-0 z-10 topbar">${brandLockup()}
        <a class="icon-btn" href="./chat.html?id=${id}"><i data-lucide="message-circle"></i></a>
      </div>
      <div class="absolute left-0 right-0 bottom-0 z-10 safe-bottom px-3">
        <section class="sheet" id="panel"></section>
      </div>
      ${passengerNav("index.html")}
    </div>`;
  bindChrome("passenger");

  const map = createMap(document.getElementById("map"));
  let driverMarker = null;
  let routeLayer = null;
  let unsubLoc = null;

  async function render(ride) {
    const panel = document.getElementById("panel");
    const drv = ride.driver;
    const vehicle = drv?.vehicles;
    panel.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="flex items-center justify-between mb-2">
        <span class="status-pill bg-brand-100 text-ink-900">${rideStatusLabel(ride.status)}</span>
        <button id="sosBtn" class="btn btn-danger btn-sm">SOS</button>
      </div>
      <p class="font-bold">${drv?.profiles?.full_name || "กำลังค้นหาคนขับใกล้คุณ..."}</p>
      <p class="text-sm text-[var(--muted)] mb-3">${vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate_number}` : ""} ${drv ? `★ ${Number(drv.rating_avg).toFixed(1)}` : ""}</p>
      <p class="text-sm"><span class="text-[var(--muted)]">จุดรับ</span> ${ride.pickup_address}</p>
      <p class="text-sm mb-3"><span class="text-[var(--muted)]">จุดส่ง</span> ${ride.dropoff_address}</p>
      <div class="flex justify-between font-semibold mb-3">
        <span>${formatKm(ride.distance_km)}</span>
        <span>${formatBaht(ride.fare_amount)}</span>
      </div>
      ${ride.status === "TRIP_COMPLETED" && !ride.ratings?.length ? `
        <div id="rateBox">
          <p class="font-semibold mb-2">ให้คะแนนคนขับ</p>
          <div id="stars" class="flex mb-2">${[1,2,3,4,5].map((n) => `<button data-n="${n}" class="star-btn"><i data-lucide="star"></i></button>`).join("")}</div>
          <textarea id="comment" class="w-full rounded-xl border border-[var(--line)] p-2 mb-2" placeholder="ความคิดเห็น"></textarea>
          <button id="rateBtn" class="btn btn-primary">ส่งคะแนน</button>
        </div>` : ""}
      ${["SEARCHING","DRIVER_ASSIGNED","DRIVER_EN_ROUTE","DRIVER_ARRIVED"].includes(ride.status) ? `<button id="cancelBtn" class="btn btn-ghost w-full mt-2">ยกเลิกงาน</button>` : ""}
      ${ride.payments?.[0]?.method === "promptpay" && ride.payments?.[0]?.status === "pending" ? `<p class="text-xs text-[var(--muted)] mt-2">PromptPay รอการยืนยันจากระบบชำระเงิน — ยังไม่ถือว่าชำระแล้ว</p>` : ""}
    `;
    initIcons(panel);

    setMarker(map, null, [ride.pickup_lat, ride.pickup_lng], divIcon("#d4a017"));
    setMarker(map, null, [ride.dropoff_lat, ride.dropoff_lng], divIcon("#121110"));
    try {
      const route = await osrmRoute(
        { lat: ride.pickup_lat, lng: ride.pickup_lng },
        { lat: ride.dropoff_lat, lng: ride.dropoff_lng }
      );
      routeLayer = drawRoute(map, routeLayer, route.coords);
    } catch { /* ignore */ }

    if (ride.driver_id) {
      unsubLoc?.();
      unsubLoc = subscribeDriverLocation(ride.driver_id, (loc) => {
        if (!loc) return;
        driverMarker = setMarker(map, driverMarker, [loc.latitude, loc.longitude], divIcon("#15803d"));
      });
      const { data: loc } = await getSupabase()
        .from("driver_locations")
        .select("*")
        .eq("driver_id", ride.driver_id)
        .maybeSingle();
      if (loc) driverMarker = setMarker(map, driverMarker, [loc.latitude, loc.longitude], divIcon("#15803d"));
    }

    document.getElementById("sosBtn")?.addEventListener("click", async () => {
      try {
        await triggerSos(ride.id, ride.pickup_lat, ride.pickup_lng);
        showToast("ส่งสัญญาณ SOS แล้ว");
      } catch (e) {
        showToast(tError(e), "error");
      }
    });
    document.getElementById("cancelBtn")?.addEventListener("click", async () => {
      try {
        await cancelRide(ride.id, "passenger_cancel");
      } catch (e) {
        showToast(tError(e), "error");
      }
    });
    let score = 5;
    document.querySelectorAll("#stars .star-btn").forEach((b) => {
      b.addEventListener("click", () => {
        score = Number(b.dataset.n);
        document.querySelectorAll("#stars .star-btn").forEach((x) => x.classList.toggle("on", Number(x.dataset.n) <= score));
      });
    });
    document.getElementById("rateBtn")?.addEventListener("click", async () => {
      try {
        await submitRating(ride.id, score, document.getElementById("comment").value);
        showToast("ส่งคะแนนแล้ว");
        document.getElementById("rateBox").innerHTML = `<p class="text-sm">ขอบคุณสำหรับความคิดเห็น</p>`;
      } catch (e) {
        showToast(tError(e), "error");
      }
    });
  }

  let ride = await fetchRide(id);
  if (!ride) {
    showToast("ไม่พบข้อมูล", "error");
    return go("./index.html");
  }
  await render(ride);
  subscribeRide(id, async () => {
    ride = await fetchRide(id);
    await render(ride);
  });
}

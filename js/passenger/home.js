import { requireAuth } from "../guards.js";
import { brandLockup, passengerNav, iconButtons, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { createMap, setMarker, drawRoute, divIcon } from "../map/map.js";
import { watchGps } from "../map/gps.js";
import { osrmRoute } from "../map/osrm.js";
import { searchPlacesDebounced, reverseGeocode } from "../map/geocode.js";
import { calculateFare, fetchActiveRideForPassenger, requestRide, retryMatch } from "../services/rides.js";
import { nearbyStands } from "../services/admin.js";
import { unreadCount } from "../services/notifications.js";
import { subscribeNotifications } from "../realtime/notifications.js";
import { formatBaht, formatKm, formatMin, go, showToast, tError, initIcons } from "../utils.js";

export async function bootPassengerHome() {
  const profile = await requireAuth("passenger");
  if (!profile) return;

  let unread = 0;
  try {
    unread = await unreadCount(profile.id);
  } catch {
    unread = 0;
  }

  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="relative h-[100dvh] overflow-hidden">
      <div id="map" class="absolute inset-0 app-map"></div>
      <div class="absolute top-0 left-0 right-0 z-10">
        <div class="topbar">
          ${brandLockup()}
          ${iconButtons(unread)}
        </div>
      </div>
      <div class="absolute left-0 right-0 bottom-0 z-10 safe-bottom px-3">
        <section class="sheet">
          <div class="sheet-handle"></div>
          <p class="text-sm text-[var(--muted)]">สวัสดี, คุณ</p>
          <h1 class="text-2xl font-bold mb-3">${profile.full_name || "ผู้โดยสาร"}</h1>
          <p class="font-semibold mb-2">คุณต้องการไปที่ไหน?</p>
          <div class="relative mb-3">
            <i data-lucide="search" class="absolute left-3 top-3.5 w-5 h-5 text-[var(--muted)]"></i>
            <input id="destSearch" class="w-full h-12 rounded-2xl border border-[var(--line)] bg-[var(--bg)] pl-11 pr-3" placeholder="ค้นหาปลายทาง" />
            <div id="destResults" class="absolute left-0 right-0 top-14 card overflow-hidden hidden z-20"></div>
          </div>
          <button id="pickupRow" class="w-full text-left card p-3 mb-2">
            <p class="text-xs text-[var(--muted)]">จุดรับ</p>
            <p id="pickupLabel" class="font-semibold truncate">กำลังระบุตำแหน่งปัจจุบัน...</p>
          </button>
          <button id="dropRow" class="w-full text-left card p-3 mb-3">
            <p class="text-xs text-[var(--muted)]">ปลายทาง</p>
            <p id="dropLabel" class="font-semibold truncate">เลือกปลายทาง</p>
          </button>
          <div class="grid grid-cols-3 gap-2 mb-3 text-center">
            <div class="card p-3"><p class="text-xs text-[var(--muted)]">ระยะทาง</p><p id="dist" class="font-bold">-</p></div>
            <div class="card p-3"><p class="text-xs text-[var(--muted)]">เวลา</p><p id="eta" class="font-bold">-</p></div>
            <div class="card p-3"><p class="text-xs text-[var(--muted)]">ค่าโดยสาร</p><p id="fare" class="font-bold">-</p></div>
          </div>
          <div class="flex gap-2 mb-3">
            <select id="payMethod" class="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 h-12">
              <option value="cash">เงินสด</option>
              <option value="promptpay">PromptPay</option>
            </select>
            <a href="./favorites.html" class="icon-btn h-12 w-12"><i data-lucide="heart"></i></a>
          </div>
          <div id="stands" class="text-xs text-[var(--muted)] mb-3"></div>
          <button id="bookBtn" class="btn btn-primary" disabled>เรียกรถ</button>
        </section>
      </div>
      ${passengerNav("index.html")}
    </div>`;
  bindChrome("passenger");
  initIcons();

  subscribeNotifications(profile.id, () => {});

  const active = await fetchActiveRideForPassenger(profile.id).catch(() => null);
  if (active) {
    go(`./ride.html?id=${active.id}`);
    return;
  }

  const map = createMap(document.getElementById("map"));
  let pickup = null;
  let drop = null;
  let pickupMarker = null;
  let dropMarker = null;
  let routeLayer = null;
  let quote = null;

  const refreshRoute = async () => {
    if (!pickup || !drop) return;
    try {
      const route = await osrmRoute(pickup, drop);
      const fare = await calculateFare(route.distanceKm);
      quote = { ...route, fare };
      routeLayer = drawRoute(map, routeLayer, route.coords);
      document.getElementById("dist").textContent = formatKm(route.distanceKm);
      document.getElementById("eta").textContent = formatMin(route.durationMin);
      document.getElementById("fare").textContent = formatBaht(fare);
      document.getElementById("bookBtn").disabled = false;
    } catch (e) {
      quote = null;
      document.getElementById("bookBtn").disabled = true;
      showToast(tError("no_route"), "error");
    }
  };

  watchGps({
    onChange: async (pos) => {
      if (!pickup) {
        pickup = { lat: pos.lat, lng: pos.lng, address: "ตำแหน่งปัจจุบัน" };
        pickupMarker = setMarker(map, pickupMarker, [pos.lat, pos.lng], divIcon("#d4a017"));
        map.setView([pos.lat, pos.lng], 15);
        try {
          pickup.address = await reverseGeocode(pos.lat, pos.lng);
        } catch {
          pickup.address = "ตำแหน่งปัจจุบัน";
        }
        document.getElementById("pickupLabel").textContent = pickup.address;
        nearbyStands(pos.lat, pos.lng)
          .then((rows) => {
            document.getElementById("stands").textContent = rows.length
              ? `วินใกล้คุณ: ${rows.map((s) => s.name).join(" · ")}`
              : "";
          })
          .catch(() => {});
      }
    },
    onError: () => {
      document.getElementById("pickupLabel").textContent = "ไม่สามารถระบุตำแหน่งได้";
      showToast("ไม่สามารถระบุตำแหน่งได้", "error");
    },
  });

  document.getElementById("pickupRow").addEventListener("click", () => {
    showToast("แตะบนแผนที่เพื่อปักหมุดจุดรับ");
    map.once("click", async (e) => {
      pickup = { lat: e.latlng.lat, lng: e.latlng.lng };
      pickupMarker = setMarker(map, pickupMarker, e.latlng, divIcon("#d4a017"));
      pickup.address = await reverseGeocode(pickup.lat, pickup.lng);
      document.getElementById("pickupLabel").textContent = pickup.address;
      refreshRoute();
    });
  });

  document.getElementById("destSearch").addEventListener("input", (ev) => {
    const box = document.getElementById("destResults");
    searchPlacesDebounced(ev.target.value, (rows) => {
      if (!rows.length) {
        box.classList.add("hidden");
        return;
      }
      box.classList.remove("hidden");
      box.innerHTML = rows
        .map(
          (r, i) =>
            `<button data-i="${i}" class="block w-full text-left px-3 py-3 border-b border-[var(--line)] text-sm">${r.name}</button>`
        )
        .join("");
      box.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          const r = rows[Number(btn.dataset.i)];
          drop = { lat: r.lat, lng: r.lng, address: r.name };
          dropMarker = setMarker(map, dropMarker, [r.lat, r.lng], divIcon("#121110"));
          document.getElementById("dropLabel").textContent = r.name;
          box.classList.add("hidden");
          refreshRoute();
        });
      });
    });
  });

  document.getElementById("bookBtn").addEventListener("click", async () => {
    if (!pickup || !drop || !quote) return;
    const btn = document.getElementById("bookBtn");
    btn.disabled = true;
    btn.textContent = "กำลังค้นหาคนขับใกล้คุณ...";
    try {
      let ride = await requestRide({
        p_pickup_address: pickup.address,
        p_pickup_lat: pickup.lat,
        p_pickup_lng: pickup.lng,
        p_dropoff_address: drop.address,
        p_dropoff_lat: drop.lat,
        p_dropoff_lng: drop.lng,
        p_distance_km: quote.distanceKm,
        p_duration_min: quote.durationMin,
        p_payment_method: document.getElementById("payMethod").value,
      });
      if (ride.status === "SEARCHING") {
        const started = Date.now();
        while (ride.status === "SEARCHING" && Date.now() - started < 90000) {
          await new Promise((r) => setTimeout(r, 5000));
          ride = await retryMatch(ride.id);
        }
      }
      if (ride.status === "CANCELLED") {
        showToast("ไม่พบคนขับใกล้คุณ", "error");
        btn.disabled = false;
        btn.textContent = "เรียกรถ";
        return;
      }
      go(`./ride.html?id=${ride.id}`);
    } catch (err) {
      showToast(tError(err), "error");
      btn.disabled = false;
      btn.textContent = "เรียกรถ";
    }
  });
}

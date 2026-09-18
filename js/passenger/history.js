import { requireAuth } from "../guards.js";
import { brandLockup, passengerNav, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { fetchRideHistory } from "../services/rides.js";
import { formatBaht, formatTime, rideStatusLabel, renderState, tError } from "../utils.js";
import { skeletonCards } from "../components/ui.js";

export async function bootListPage({ role, nav, title, load, row }) {
  const profile = await requireAuth(role);
  if (!profile) return;
  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="max-w-lg mx-auto min-h-full safe-bottom">
      <div class="topbar">${brandLockup()}<h1 class="font-bold">${title}</h1><span></span></div>
      <div id="list" class="px-4">${skeletonCards(4)}</div>
    </div>
    ${nav}`;
  bindChrome(role);
  try {
    const items = await load(profile);
    const el = document.getElementById("list");
    if (!items.length) return renderState(el, "empty", "ยังไม่มีรายการ");
    el.innerHTML = items.map(row).join("");
  } catch (e) {
    renderState(document.getElementById("list"), "error", tError(e));
  }
}

export async function bootPassengerHistory() {
  const { passengerNav } = await import("../components/nav.js");
  await bootListPage({
    role: "passenger",
    nav: passengerNav("history.html"),
    title: "ประวัติ",
    load: fetchRideHistory,
    row: (r) => `<a href="./ride.html?id=${r.id}" class="card p-4 mb-3 block">
      <div class="flex justify-between"><strong>${rideStatusLabel(r.status)}</strong><span>${formatBaht(r.fare_amount)}</span></div>
      <p class="text-sm text-[var(--muted)] mt-1">${r.pickup_address} → ${r.dropoff_address}</p>
      <p class="text-xs mt-1">${formatTime(r.created_at)}</p>
    </a>`,
  });
}

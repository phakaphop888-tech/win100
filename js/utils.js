const THAI = {
  missing_config: "ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ",
  not_authenticated: "เซสชันหมดอายุ",
  forbidden: "ไม่มีสิทธิ์ทำรายการนี้",
  not_found: "ไม่พบข้อมูล",
  illegal_transition: "ไม่สามารถเปลี่ยนสถานะนี้ได้",
  job_taken: "งานนี้ถูกรับไปแล้ว",
  driver_not_eligible: "ยังไม่สามารถออนไลน์หรือรับงานได้",
  not_approved: "บัญชีคนขับยังไม่ได้รับการอนุมัติ",
  active_ride_exists: "คุณมีงานที่ยังไม่เสร็จ",
  gps_denied: "ไม่สามารถระบุตำแหน่งได้",
  no_route: "ไม่พบเส้นทาง",
  no_driver: "ไม่พบคนขับใกล้คุณ",
  network: "ไม่สามารถเชื่อมต่อระบบได้",
  search_timeout: "หมดเวลารอคนขับ",
  generic: "เกิดข้อผิดพลาด กรุณาลองใหม่",
};

export function tError(err) {
  const raw = String(err?.message || err?.code || err || "");
  const key = raw.replace("PGRST", "").split("\n")[0].trim();
  if (THAI[key]) return THAI[key];
  if (/Failed to fetch|NetworkError|offline/i.test(raw)) return THAI.network;
  if (/JWT|expired|session/i.test(raw)) return THAI.not_authenticated;
  return THAI.generic;
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $all(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function formatBaht(n) {
  const v = Number(n || 0);
  return `฿${v.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

export function formatKm(n) {
  return `${Number(n || 0).toFixed(1)} กม.`;
}

export function formatMin(n) {
  return `${Math.max(1, Math.round(Number(n || 0)))} นาที`;
}

export function formatTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export function rideStatusLabel(status) {
  const map = {
    SEARCHING: "กำลังค้นหาคนขับ",
    DRIVER_ASSIGNED: "พบคนขับแล้ว",
    DRIVER_EN_ROUTE: "คนขับกำลังมา",
    DRIVER_ARRIVED: "คนขับถึงจุดรับ",
    TRIP_STARTED: "กำลังเดินทาง",
    TRIP_COMPLETED: "เสร็จสิ้น",
    CANCELLED: "ยกเลิก",
  };
  return map[status] || status;
}

export function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

export function go(path) {
  location.href = path;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function initIcons(root = document) {
  if (window.lucide?.createIcons) window.lucide.createIcons({ root });
}

export function setOnlineBanner() {
  const apply = () => document.documentElement.classList.toggle("is-offline", !navigator.onLine);
  window.addEventListener("online", apply);
  window.addEventListener("offline", apply);
  apply();
}

export function showToast(message, type = "info") {
  let host = document.querySelector(".toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    document.body.append(host);
  }
  const el = document.createElement("div");
  el.className = "card px-4 py-3 text-sm font-medium";
  el.textContent = message;
  if (type === "error") el.style.borderColor = "var(--danger)";
  host.append(el);
  setTimeout(() => el.remove(), 3600);
}

export function renderState(target, kind, title, detail = "") {
  if (!target) return;
  const icons = { empty: "inbox", error: "triangle-alert", loading: "loader-circle", success: "check" };
  target.innerHTML = `
    <div class="${kind}-state">
      <i data-lucide="${icons[kind] || "info"}" class="mx-auto mb-3 ${kind === "loading" ? "animate-spin" : ""}"></i>
      <p class="font-semibold text-[var(--ink)]">${title}</p>
      ${detail ? `<p class="text-sm mt-1">${detail}</p>` : ""}
    </div>`;
  initIcons(target);
}

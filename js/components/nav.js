import { assetPrefix } from "../guards.js";
import { signOut } from "../auth.js";
import { currentTheme, toggleTheme } from "./theme.js";
import { initIcons } from "../utils.js";

export function renderOfflineBanner() {
  return `<div class="offline-banner">คุณออฟไลน์อยู่ — บางฟีเจอร์จะใช้ไม่ได้จนกว่าจะเชื่อมต่อใหม่</div>`;
}

export function brandLockup() {
  return `<div class="brand-mark"><span class="logo"><i data-lucide="bike" class="w-4 h-4"></i></span>WIN100</div>`;
}

export function passengerNav(active) {
  const p = assetPrefix();
  const items = [
    ["index.html", "house", "หน้าแรก"],
    ["history.html", "clock", "ประวัติ"],
    ["notifications.html", "bell", "แจ้งเตือน"],
    ["profile.html", "user", "โปรไฟล์"],
  ];
  return `<nav class="bottom-nav">${items
    .map(
      ([href, icon, label]) =>
        `<a href="${p}/passenger/${href}" class="${active === href ? "active" : ""}"><i data-lucide="${icon}"></i>${label}</a>`
    )
    .join("")}</nav>`;
}

export function driverNav(active) {
  const p = assetPrefix();
  const items = [
    ["index.html", "house", "หน้าแรก"],
    ["jobs.html", "briefcase", "งาน"],
    ["earnings.html", "wallet", "รายได้"],
    ["profile.html", "user", "โปรไฟล์"],
  ];
  return `<nav class="bottom-nav">${items
    .map(
      ([href, icon, label]) =>
        `<a href="${p}/driver/${href}" class="${active === href ? "active" : ""}"><i data-lucide="${icon}"></i>${label}</a>`
    )
    .join("")}</nav>`;
}

export function adminSidebar(active) {
  const p = assetPrefix();
  const items = [
    ["index.html", "layout-dashboard", "Dashboard"],
    ["map.html", "map", "Live Map"],
    ["drivers.html", "bike", "Drivers"],
    ["users.html", "users", "Users"],
    ["jobs.html", "clipboard-list", "Jobs"],
    ["payments.html", "banknote", "Payments"],
    ["reviews.html", "star", "Reviews"],
    ["reports.html", "chart-column", "Reports"],
    ["notifications.html", "bell", "Notifications"],
    ["support.html", "life-buoy", "Support"],
    ["audit.html", "scroll-text", "Audit Logs"],
    ["stands.html", "map-pin", "Win Stands"],
    ["sos.html", "siren", "SOS"],
    ["settings.html", "settings", "Settings"],
  ];
  return `<aside class="admin-side">${brandLockup()}
    ${items
      .map(
        ([href, icon, label]) =>
          `<a href="${p}/admin/${href}" class="${active === href ? "active" : ""}"><i data-lucide="${icon}" class="w-4 h-4"></i>${label}</a>`
      )
      .join("")}
  </aside>`;
}

export function iconButtons(unread = 0) {
  const p = assetPrefix();
  return `<div class="flex items-center gap-2">
    <button class="icon-btn" id="themeToggle" type="button" aria-label="สลับโหมดสี">
      <i data-lucide="${currentTheme() === "dark" ? "sun" : "moon"}"></i>
    </button>
    <a class="icon-btn relative" href="${p}/passenger/notifications.html" id="notifLink" aria-label="แจ้งเตือน">
      <i data-lucide="bell"></i>
      ${unread ? `<span class="absolute -top-1 -right-1 w-4 h-4 text-[10px] rounded-full bg-brand-500 text-ink-900 grid place-items-center">${unread}</span>` : ""}
    </a>
    <a class="icon-btn" href="${p}/passenger/profile.html" aria-label="โปรไฟล์"><i data-lucide="user"></i></a>
  </div>`;
}

export function bindChrome(role) {
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    toggleTheme();
    location.reload();
  });
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut();
    location.href = `${assetPrefix()}/login.html`;
  });
  initIcons();
  if (role === "driver") {
    const link = document.getElementById("notifLink");
    if (link) link.href = `${assetPrefix()}/driver/notifications.html`;
  }
}

import { requireAuth } from "../guards.js";
import { brandLockup, passengerNav, driverNav, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { updateProfile } from "../auth.js";
import { createTicket, myTickets } from "../services/support.js";
import { showToast, tError, formatTime } from "../utils.js";

export async function bootProfile(role) {
  const profile = await requireAuth(role);
  if (!profile) return;
  const nav = role === "driver" ? driverNav("profile.html") : passengerNav("profile.html");
  const prefix = "..";
  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="max-w-lg mx-auto safe-bottom">
      <div class="topbar">${brandLockup()}<h1 class="font-bold">โปรไฟล์</h1><span></span></div>
      <form id="form" class="px-4 space-y-3">
        <div class="field"><label>ชื่อ</label><input name="full_name" value="${profile.full_name || ""}" /></div>
        <div class="field"><label>เบอร์</label><input name="phone" value="${profile.phone || ""}" /></div>
        <button class="btn btn-primary">บันทึก</button>
      </form>
      <div class="px-4 mt-6 space-y-3">
        <a class="card p-4 block" href="./settings.html">ตั้งค่า</a>
        ${role === "driver" ? `<a class="card p-4 block" href="./verification.html">ยืนยันตัวตนคนขับ</a>` : `<a class="card p-4 block" href="./favorites.html">สถานที่โปรด</a>`}
        <a class="card p-4 block" href="${prefix}/${role === "passenger" ? "passenger" : "driver"}/notifications.html">แจ้งเตือน</a>
        <button id="logoutBtn" class="btn btn-ghost w-full">ออกจากระบบ</button>
      </div>
      <form id="ticket" class="px-4 mt-8 space-y-3">
        <h2 class="font-bold">ติดต่อซัพพอร์ต</h2>
        <div class="field"><label>หัวข้อ</label><input name="subject" required /></div>
        <div class="field"><label>รายละเอียด</label><textarea name="message" required></textarea></div>
        <button class="btn btn-primary">ส่งเรื่อง</button>
      </form>
      <div id="tickets" class="px-4 mt-4"></div>
    </div>
    ${nav}`;
  bindChrome(role);

  document.getElementById("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await updateProfile({ full_name: fd.get("full_name"), phone: fd.get("phone") });
      showToast("บันทึกแล้ว");
    } catch (e) {
      showToast(tError(e), "error");
    }
  });
  document.getElementById("ticket").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await createTicket({ profile_id: profile.id, subject: fd.get("subject"), message: fd.get("message") });
      ev.target.reset();
      showToast("ส่งเรื่องแล้ว");
      loadTickets();
    } catch (e) {
      showToast(tError(e), "error");
    }
  });
  async function loadTickets() {
    const rows = await myTickets(profile.id).catch(() => []);
    document.getElementById("tickets").innerHTML = rows.map((t) => `<article class="card p-3 mb-2"><p class="font-semibold">${t.subject}</p><p class="text-xs">${t.status} · ${formatTime(t.created_at)}</p>${t.admin_reply ? `<p class="text-sm mt-1">${t.admin_reply}</p>` : ""}</article>`).join("");
  }
  loadTickets();
}

export async function bootSettings(role) {
  const profile = await requireAuth(role);
  if (!profile) return;
  const { toggleTheme, currentTheme } = await import("../components/theme.js");
  const nav = role === "admin" ? "" : role === "driver" ? driverNav("profile.html") : passengerNav("profile.html");
  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="max-w-lg mx-auto safe-bottom">
      <div class="topbar">${brandLockup()}<h1 class="font-bold">ตั้งค่า</h1><span></span></div>
      <div class="px-4 space-y-3">
        <button id="theme" class="card p-4 w-full text-left">โหมดสี: ${currentTheme() === "dark" ? "มืด" : "สว่าง"}</button>
        <p class="text-sm text-[var(--muted)]">บัญชี: ${profile.role}</p>
      </div>
    </div>${nav}`;
  bindChrome(role);
  document.getElementById("theme").addEventListener("click", () => {
    toggleTheme();
    location.reload();
  });
}

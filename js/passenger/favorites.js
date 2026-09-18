import { requireAuth } from "../guards.js";
import { brandLockup, passengerNav, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { listFavorites, addFavorite, removeFavorite } from "../services/favorites.js";
import { reverseGeocode } from "../map/geocode.js";
import { getCurrentGps } from "../map/gps.js";
import { showToast, tError, renderState } from "../utils.js";

const labels = { home: "บ้าน", school: "โรงเรียน", university: "มหาวิทยาลัย", work: "ที่ทำงาน", other: "อื่น ๆ" };

export async function bootFavorites() {
  const profile = await requireAuth("passenger");
  if (!profile) return;
  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="max-w-lg mx-auto safe-bottom">
      <div class="topbar">${brandLockup()}<h1 class="font-bold">สถานที่โปรด</h1><span></span></div>
      <form id="form" class="px-4 space-y-3">
        <div class="field"><label>ชื่อ</label><input name="name" required /></div>
        <div class="field"><label>ประเภท</label>
          <select name="label">${Object.entries(labels).map(([k,v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        </div>
        <button class="btn btn-primary" type="submit">บันทึกตำแหน่งปัจจุบัน</button>
      </form>
      <div id="list" class="px-4 mt-4"></div>
    </div>
    ${passengerNav("index.html")}`;
  bindChrome("passenger");

  async function refresh() {
    const list = document.getElementById("list");
    try {
      const rows = await listFavorites();
      if (!rows.length) return renderState(list, "empty", "ยังไม่มีสถานที่โปรด");
      list.innerHTML = rows.map((r) => `<div class="card p-4 mb-3 flex justify-between gap-3">
        <div><p class="font-semibold">${r.name}</p><p class="text-sm text-[var(--muted)]">${labels[r.label] || r.label} · ${r.address}</p></div>
        <button data-id="${r.id}" class="btn btn-ghost btn-sm del">ลบ</button>
      </div>`).join("");
      list.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
        await removeFavorite(b.dataset.id);
        refresh();
      }));
    } catch (e) {
      renderState(list, "error", tError(e));
    }
  }

  document.getElementById("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const pos = await getCurrentGps();
      const address = await reverseGeocode(pos.lat, pos.lng);
      const fd = new FormData(ev.target);
      await addFavorite({
        profile_id: profile.id,
        name: fd.get("name"),
        label: fd.get("label"),
        address,
        latitude: pos.lat,
        longitude: pos.lng,
      });
      ev.target.reset();
      refresh();
    } catch (e) {
      showToast(tError(e), "error");
    }
  });
  refresh();
}

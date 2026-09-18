import { bootListPage } from "./history.js";
import { passengerNav } from "../components/nav.js";
import { listNotifications, markAllRead } from "../services/notifications.js";
import { formatTime } from "../utils.js";

export async function bootPassengerNotifications() {
  await bootListPage({
    role: "passenger",
    nav: passengerNav("notifications.html"),
    title: "แจ้งเตือน",
    load: async (profile) => {
      const rows = await listNotifications();
      markAllRead(profile.id).catch(() => {});
      return rows;
    },
    row: (n) => `<article class="card p-4 mb-3">
      <p class="font-semibold">${n.title}</p>
      <p class="text-sm text-[var(--muted)]">${n.body}</p>
      <p class="text-xs mt-1">${formatTime(n.created_at)}</p>
    </article>`,
  });
}

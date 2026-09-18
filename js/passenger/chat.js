import { requireAuth } from "../guards.js";
import { brandLockup, bindChrome, renderOfflineBanner } from "../components/nav.js";
import { listMessages, sendMessage, markChatRead } from "../services/chat.js";
import { subscribeChat } from "../realtime/chat.js";
import { qs, formatTime, go, showToast, tError, initIcons } from "../utils.js";

export async function bootChat(role, backHref) {
  const profile = await requireAuth(role);
  if (!profile) return;
  const id = qs("id");
  if (!id) return go(backHref);

  document.body.innerHTML = `
    ${renderOfflineBanner()}
    <div class="max-w-lg mx-auto min-h-[100dvh] flex flex-col">
      <div class="topbar"><a href="${backHref}" class="icon-btn"><i data-lucide="arrow-left"></i></a>${brandLockup()}<span></span></div>
      <div id="msgs" class="flex-1 px-4 space-y-2 overflow-y-auto pb-4"></div>
      <form id="form" class="p-3 flex gap-2 border-t border-[var(--line)] bg-[var(--surface)]">
        <input name="body" class="flex-1 h-12 rounded-2xl border border-[var(--line)] px-3 bg-[var(--bg)]" placeholder="พิมพ์ข้อความ" required />
        <button class="btn btn-primary btn-sm w-14">ส่ง</button>
      </form>
    </div>`;
  bindChrome(role);

  const box = document.getElementById("msgs");
  const add = (m) => {
    const mine = m.sender_id === profile.id;
    box.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-bubble ${mine ? "me" : "them"}">${m.body}<div class="text-[10px] opacity-70 mt-1">${formatTime(m.created_at)}${mine && m.read_at ? " · อ่านแล้ว" : ""}</div></div>`
    );
    box.scrollTop = box.scrollHeight;
  };

  try {
    (await listMessages(id)).forEach(add);
    await markChatRead(id, profile.id);
  } catch (e) {
    showToast(tError(e), "error");
  }

  subscribeChat(id, add);
  document.getElementById("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = ev.target.body;
    try {
      await sendMessage(id, profile.id, input.value.trim());
      input.value = "";
    } catch (e) {
      showToast(tError(e), "error");
    }
  });
  initIcons();
}

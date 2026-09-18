export function skeletonCards(n = 3) {
  return Array.from({ length: n }, () => `<div class="skeleton h-24 mb-3"></div>`).join("");
}

export function modalHtml(id, title, body, actions = "") {
  return `<dialog id="${id}" class="w-[min(420px,calc(100%-24px))] rounded-2xl p-0 bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)]">
    <form method="dialog" class="p-5">
      <h3 class="text-lg font-bold mb-3">${title}</h3>
      <div class="text-sm text-[var(--muted)]">${body}</div>
      <div class="mt-5 flex gap-2">${actions}</div>
    </form>
  </dialog>`;
}

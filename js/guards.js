import { getProfile, getSession } from "./auth.js";
import { go, showToast, tError, setOnlineBanner, initIcons } from "./utils.js";
import { applyTheme } from "./components/theme.js";

function homeFor(role) {
  if (role === "admin") return "admin/index.html";
  if (role === "driver") return "driver/index.html";
  return "passenger/index.html";
}

export function assetPrefix() {
  if (location.pathname.includes("/passenger/") || location.pathname.includes("/driver/") || location.pathname.includes("/admin/")) {
    return "..";
  }
  return ".";
}

export async function requireAuth(expectedRole) {
  applyTheme();
  setOnlineBanner();
  try {
    const session = await getSession();
    if (!session) {
      go(`${assetPrefix()}/login.html`);
      return null;
    }
    const profile = await getProfile();
    if (!profile) {
      go(`${assetPrefix()}/login.html`);
      return null;
    }
    if (profile.status === "suspended") {
      showToast("บัญชีถูกระงับการใช้งาน", "error");
      go(`${assetPrefix()}/login.html`);
      return null;
    }
    if (expectedRole && profile.role !== expectedRole) {
      go(`${assetPrefix()}/${homeFor(profile.role)}`);
      return null;
    }
    initIcons();
    return profile;
  } catch (err) {
    showToast(tError(err), "error");
    go(`${assetPrefix()}/login.html`);
    return null;
  }
}

export async function redirectIfAuthed() {
  applyTheme();
  setOnlineBanner();
  try {
    const session = await getSession();
    if (!session) return null;
    const profile = await getProfile();
    if (profile) go(`${assetPrefix()}/${homeFor(profile.role)}`);
    return profile;
  } catch {
    return null;
  }
}

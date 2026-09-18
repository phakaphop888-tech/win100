const KEY = "win100-theme";

export function currentTheme() {
  return localStorage.getItem(KEY) || "light";
}

export function applyTheme(theme = currentTheme()) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(KEY, theme);
}

export function toggleTheme() {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
}

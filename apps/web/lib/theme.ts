import { safeStorage } from "./safe-storage";

export const THEME_STORAGE_KEY = "shengji-theme";

export const THEMES = [
  { id: "default", label: "Default" },
  { id: "retro", label: "Retro" },
  { id: "minimal", label: "Minimal" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some(({ id }) => id === value);
}

/** The active theme, from the html attribute the init script already set. */
export function currentTheme(): ThemeId {
  const applied = document.documentElement.dataset.theme ?? null;
  return isThemeId(applied) ? applied : "default";
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  safeStorage.set(THEME_STORAGE_KEY, theme);
}

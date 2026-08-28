import type { AppearanceMode, EffectiveTheme } from "../types/preferences";

export function resolveEffectiveTheme(
  appearanceMode: AppearanceMode,
  systemIsDark: boolean,
): EffectiveTheme {
  if (appearanceMode === "system") return systemIsDark ? "dark" : "light";
  return appearanceMode;
}

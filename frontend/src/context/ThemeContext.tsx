import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { usePreferencesContext } from "./PreferencesContext";
import { ThemeContext } from "./themeContext";
import { resolveEffectiveTheme } from "../theme/resolveEffectiveTheme";
import type { EffectiveTheme } from "../types/preferences";

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferencesContext();
  const appearanceMode = preferences?.appearance_mode ?? "system";
  const [currentSystemTheme, setCurrentSystemTheme] =
    useState<EffectiveTheme>(systemTheme);
  const effectiveTheme = resolveEffectiveTheme(
    appearanceMode,
    currentSystemTheme === "dark",
  );

  useEffect(() => {
    if (appearanceMode !== "system") return;
    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => {
      setCurrentSystemTheme(event.matches ? "dark" : "light");
    };

    updateSystemTheme(media);
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [appearanceMode]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", effectiveTheme === "dark");
    root.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  const value = useMemo(
    () => ({ appearanceMode, effectiveTheme }),
    [appearanceMode, effectiveTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

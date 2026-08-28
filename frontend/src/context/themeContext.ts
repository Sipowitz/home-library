import { createContext } from "react";

import type { AppearanceMode, EffectiveTheme } from "../types/preferences";

export type ThemeContextValue = {
  appearanceMode: AppearanceMode;
  effectiveTheme: EffectiveTheme;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

import { usePreferencesContext } from "../context/PreferencesContext";

export function usePreferences() {
  return usePreferencesContext();
}

import { StatsPanel } from "../stats/StatsPanel";
import { usePreferences } from "../../hooks/usePreferences";

export function TopPanels() {
  const { preferences } = usePreferences();
  const showDesktop = preferences?.show_stats_desktop ?? true;
  const showMobile = preferences?.show_stats_mobile ?? true;

  if (!showDesktop && !showMobile) return null;

  return (
    <div className={`${showMobile ? "block" : "hidden"} ${showDesktop ? "lg:block" : "lg:hidden"}`}>
        <StatsPanel />
    </div>
  );
}

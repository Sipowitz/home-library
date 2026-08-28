import toast from "react-hot-toast";
import { usePreferences } from "../../../hooks/usePreferences";
import type { PreferencesUpdate } from "../../../types/preferences";

export function AppearanceSettings() {
  const { preferences, updatePreferences, loading } = usePreferences();

  if (loading || !preferences) {
    return <div className="text-sm text-gray-400">Loading preferences...</div>;
  }

  async function updateVisibility(change: PreferencesUpdate) {
    try {
      await updatePreferences(change);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update appearance");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-white">Library Stats</h3>
        <p className="mt-1 text-sm text-gray-400">
          Choose where the library statistics panel is displayed.
        </p>
      </div>

      <div className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/60">
        <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm text-gray-200">
          <span>Show Library Stats on desktop</span>
          <input
            type="checkbox"
            checked={preferences.show_stats_desktop}
            onChange={(event) => void updateVisibility({ show_stats_desktop: event.target.checked })}
            className="h-4 w-4 accent-blue-600"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm text-gray-200">
          <span>Show Library Stats on mobile</span>
          <input
            type="checkbox"
            checked={preferences.show_stats_mobile}
            onChange={(event) => void updateVisibility({ show_stats_mobile: event.target.checked })}
            className="h-4 w-4 accent-blue-600"
          />
        </label>
      </div>
    </div>
  );
}

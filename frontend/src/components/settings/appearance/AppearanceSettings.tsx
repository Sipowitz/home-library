import toast from "react-hot-toast";
import { usePreferences } from "../../../hooks/usePreferences";
import type {
  AppearanceMode,
  PreferencesUpdate,
} from "../../../types/preferences";

const appearanceChoices: Array<{
  value: AppearanceMode;
  label: string;
  description: string;
}> = [
  {
    value: "system",
    label: "System",
    description: "Follow the appearance setting of this device.",
  },
  { value: "light", label: "Light", description: "Use light appearance." },
  { value: "dark", label: "Dark", description: "Use dark appearance." },
];

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
        <h3 className="text-sm font-medium text-white">Appearance</h3>
        <p className="mt-1 text-sm text-gray-400">
          Choose how the Library App appears.
        </p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Appearance mode</legend>
        {appearanceChoices.map((choice) => (
          <label
            key={choice.value}
            className={`cursor-pointer rounded-xl border p-3 transition ${
              preferences.appearance_mode === choice.value
                ? "border-blue-500/60 bg-blue-500/10"
                : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-white">
              <input
                type="radio"
                name="appearance-mode"
                value={choice.value}
                checked={preferences.appearance_mode === choice.value}
                onChange={() =>
                  void updateVisibility({ appearance_mode: choice.value })
                }
                className="h-4 w-4 accent-blue-600"
              />
              {choice.label}
            </span>
            <span className="mt-1 block pl-6 text-xs text-gray-400">
              {choice.description}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="border-t border-gray-800 pt-4">
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
    </div>
  );
}

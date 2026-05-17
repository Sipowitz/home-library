import { useMemo } from "react";

import toast from "react-hot-toast";

import { usePreferences } from "../../../hooks/usePreferences";

import { formatDateTime } from "../../../utils/dateFormatters";

import type { DateFormat, TimeFormat } from "../../../types/preferences";

const DATE_FORMATS: DateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

const TIME_FORMATS: TimeFormat[] = ["24h", "12h"];

export function PreferencesSettings() {
  const { preferences, updatePreferences, loading } = usePreferences();

  const previewDate = useMemo(() => new Date("2026-05-17T18:42:00"), []);

  // -------------------
  // ⏳ LOADING
  // -------------------

  if (loading || !preferences) {
    return <div className="text-sm text-gray-400">Loading preferences...</div>;
  }

  // -------------------
  // ✏️ UPDATE
  // -------------------

  async function handleDateFormatChange(value: DateFormat) {
    try {
      await updatePreferences({
        date_format: value,
      });

      toast.success("Date format updated");
    } catch (err) {
      console.error(err);

      toast.error("Failed to update preferences");
    }
  }

  async function handleTimeFormatChange(value: TimeFormat) {
    try {
      await updatePreferences({
        time_format: value,
      });

      toast.success("Time format updated");
    } catch (err) {
      console.error(err);

      toast.error("Failed to update preferences");
    }
  }

  return (
    <div className="space-y-8">
      {/* DATE FORMAT */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Date Format</h3>

        <div className="space-y-2">
          {DATE_FORMATS.map((format) => {
            const selected = preferences.date_format === format;

            return (
              <button
                key={format}
                onClick={() => handleDateFormatChange(format)}
                className={`
                  w-full text-left
                  px-4 py-3
                  rounded-xl
                  border transition
                  ${
                    selected
                      ? "bg-gray-800 border-gray-600 text-white"
                      : "bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700"
                  }
                `}
              >
                {format}
              </button>
            );
          })}
        </div>
      </div>

      {/* TIME FORMAT */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Time Format</h3>

        <div className="space-y-2">
          {TIME_FORMATS.map((format) => {
            const selected = preferences.time_format === format;

            return (
              <button
                key={format}
                onClick={() => handleTimeFormatChange(format)}
                className={`
                  w-full text-left
                  px-4 py-3
                  rounded-xl
                  border transition
                  ${
                    selected
                      ? "bg-gray-800 border-gray-600 text-white"
                      : "bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700"
                  }
                `}
              >
                {format === "24h" ? "24 Hour" : "12 Hour (AM/PM)"}
              </button>
            );
          })}
        </div>
      </div>

      {/* LIVE PREVIEW */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Preview</h3>

        <div
          className="
            rounded-xl
            border border-gray-800
            bg-gray-900/60
            px-4 py-5
          "
        >
          <div className="text-lg text-white">
            {formatDateTime(previewDate, preferences)}
          </div>

          <div className="mt-2 text-sm text-gray-400">
            Live preview using your current preferences
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";

import toast from "react-hot-toast";

import { usePreferences } from "../../../hooks/usePreferences";

import { formatDateTime } from "../../../utils/dateFormatters";

import type { DateFormat, TimeFormat } from "../../../types/preferences";

const DATE_FORMATS: DateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

const TIME_FORMATS: TimeFormat[] = ["24h", "12h"];

export function PreferencesSettings() {
  const { preferences, updatePreferences, loading } = usePreferences();

  const previewDate = useMemo(() => new Date("2026-05-17T18:42:00"), []);
  const [libraryNameDraft, setLibraryNameDraft] = useState<string | null>(null);

  // -------------------
  // ⏳ LOADING
  // -------------------

  if (loading || !preferences) {
    return <div className="text-sm text-text-muted">Loading preferences...</div>;
  }

  const currentPreferences = preferences;

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

  async function handleLibraryNameBlur() {
    const value = (libraryNameDraft ?? currentPreferences.library_name).trim();
    if (!value || value.length > 60) {
      setLibraryNameDraft(currentPreferences.library_name);
      toast.error(!value ? "Library name must not be blank" : "Library name must be 60 characters or fewer");
      return;
    }
    if (value === currentPreferences.library_name) {
      setLibraryNameDraft(value);
      return;
    }
    try {
      await updatePreferences({ library_name: value });
      setLibraryNameDraft(value);
      toast.success("Library name updated");
    } catch (err) {
      console.error(err);
      setLibraryNameDraft(currentPreferences.library_name);
      toast.error("Failed to update library name");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="library-name" className="mb-3 block text-sm font-medium text-text-primary">Library Name</label>
        <input
          id="library-name"
          type="text"
          maxLength={60}
          value={libraryNameDraft ?? currentPreferences.library_name}
          onChange={(event) => setLibraryNameDraft(event.target.value)}
          onBlur={() => void handleLibraryNameBlur()}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          className="form-control w-full"
          aria-describedby="library-name-help"
        />
        <p id="library-name-help" className="mt-2 text-sm text-text-muted">Shown in the browser title and Library heading.</p>
      </div>

      {/* DATE FORMAT */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Date Format</h3>

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
                      ? "bg-surface-raised border-border-strong text-text-primary"
                      : "bg-surface-muted border-border text-text-secondary hover:border-border-strong"
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
        <h3 className="text-sm font-medium text-text-primary mb-3">Time Format</h3>

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
                      ? "bg-surface-raised border-border-strong text-text-primary"
                      : "bg-surface-muted border-border text-text-secondary hover:border-border-strong"
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
        <h3 className="text-sm font-medium text-text-primary mb-3">Preview</h3>

        <div
          className="
            rounded-xl
            border border-border
            bg-surface-muted
            px-4 py-5
          "
        >
          <div className="text-lg text-text-primary">
            {formatDateTime(previewDate, preferences)}
          </div>

          <div className="mt-2 text-sm text-text-muted">
            Live preview using your current preferences
          </div>
        </div>
      </div>
    </div>
  );
}

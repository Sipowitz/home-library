import React from "react";
import { Loader2 } from "lucide-react";

import { usePreferences } from "../../../hooks/usePreferences";

import { formatDateTime } from "../../../utils/dateFormatters";
import { ActionButton } from "../../ui/ActionButton";

type Props = {
  creatingBackup: boolean;

  restoring: boolean;

  validating: boolean;

  fileInputRef: React.RefObject<HTMLInputElement | null>;

  onBackup: () => void;

  onFileSelect: (file: File) => void;

  lastBackupAt: string | null;

  lastRestoreAt: string | null;
};

export function BackupSettings({
  creatingBackup,
  restoring,
  validating,
  fileInputRef,
  onBackup,
  onFileSelect,
  lastBackupAt,
  lastRestoreAt,
}: Props) {
  const { preferences } = usePreferences();

  function renderDate(value: string | null) {
    if (!value) {
      return "Never";
    }

    return formatDateTime(value, preferences);
  }

  return (
    <>
      <h3 className="text-lg mt-6 mb-4">Backup & Restore</h3>

      {/* STATUS */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Last Backup</span>

          <span className="text-text-secondary">{renderDate(lastBackupAt)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Last Restore</span>

          <span className="text-text-secondary">{renderDate(lastRestoreAt)}</span>
        </div>
      </div>

      {/* DOWNLOAD */}
      <ActionButton
        onClick={onBackup}
        disabled={creatingBackup}
        aria-busy={creatingBackup}
        variant="secondary"
        className="mb-3 w-full"
      >
        {creatingBackup && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
        {creatingBackup ? "Creating backup…" : "Download Backup"}
      </ActionButton>
      {creatingBackup && <p role="status" aria-live="polite" className="sr-only">Creating backup…</p>}

      {/* RESTORE */}
      <ActionButton
        onClick={() => fileInputRef.current?.click()}
        disabled={creatingBackup || restoring || validating}
        variant="primary"
        className="mb-2 w-full"
      >
        {validating ? "Validating..." : restoring ? "Restoring..." : "Choose Backup"}
      </ActionButton>

      {/* HINT */}
      <p className="text-xs text-text-muted mt-3">
        Backups include your books, reading state, categories, locations, preferences, metadata history, and referenced local covers. Passwords, secrets, provider API keys, and other users are excluded.
      </p>

      {/* FILE INPUT */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".lbak,application/vnd.library-app.backup+zip"
        className="hidden"
        disabled={creatingBackup}
        onChange={(e) => {
          const file = e.target.files?.[0];

          // reset input so same file works again
          e.currentTarget.value = "";

          if (file) {
            onFileSelect(file);
          }
        }}
      />
    </>
  );
}

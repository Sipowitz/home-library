import React from "react";

type Props = {
  restoring: boolean;

  fileInputRef: React.RefObject<HTMLInputElement | null>;

  onBackup: () => void;

  onFileSelect: (file: File) => void;

  lastBackupAt: string | null;

  lastRestoreAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Never";

  return new Date(value).toLocaleString();
}

export function BackupSettings({
  restoring,
  fileInputRef,
  onBackup,
  onFileSelect,
  lastBackupAt,
  lastRestoreAt,
}: Props) {
  return (
    <>
      <h3 className="text-lg mt-6 mb-4">Backup & Restore</h3>

      {/* STATUS */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Last Backup</span>

          <span className="text-gray-200">{formatDate(lastBackupAt)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Last Restore</span>

          <span className="text-gray-200">{formatDate(lastRestoreAt)}</span>
        </div>
      </div>

      {/* DOWNLOAD */}
      <button
        onClick={onBackup}
        className="
          w-full
          py-2.5
          rounded-xl
          mb-3
          bg-green-600 hover:bg-green-500
          transition
        "
      >
        Download Backup
      </button>

      {/* RESTORE */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={restoring}
        className="
          w-full
          py-2.5
          rounded-xl
          mb-2
          bg-blue-600 hover:bg-blue-500
          disabled:opacity-60
          transition
        "
      >
        {restoring ? "Restoring..." : "Upload Backup"}
      </button>

      {/* HINT */}
      <p className="text-xs text-gray-500 mt-3">
        Backups include your books, categories, locations, and metadata.
      </p>

      {/* FILE INPUT */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
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

import React from "react";

type Props = {
  restoring: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onBackup: () => void;
  onFileSelect: (file: File) => void;
};

export function BackupSettings({
  restoring,
  fileInputRef,
  onBackup,
  onFileSelect,
}: Props) {
  return (
    <>
      <h3 className="text-lg mt-6 mb-2">Backup & Restore</h3>

      <button
        onClick={onBackup}
        className="bg-green-600 w-full py-2 rounded mb-2"
      >
        Download Backup
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={restoring}
        className="bg-blue-600 w-full py-2 rounded mb-2"
      >
        {restoring ? "Restoring..." : "Upload Backup"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];

          // reset input so same file works again
          e.currentTarget.value = "";

          if (file) onFileSelect(file);
        }}
      />
    </>
  );
}

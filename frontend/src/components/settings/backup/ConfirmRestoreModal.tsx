export type BackupValidationSummary = {
  books: number;
  categories: number;
  locations: number;
  metadata_records: number;
  metadata_snapshots: number;
  normalized_metadata_records: number;
  cover_files: number;
  created_at: string;
  backup_version: number;
  source_username: string;
};

type Props = {
  open: boolean;
  restoring: boolean;
  file: File | null;
  summary: BackupValidationSummary | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmRestoreModal({ open, restoring, file, summary, onConfirm, onCancel }: Props) {
  if (!open || !summary) return null;
  const rows = [
    ["Books", summary.books], ["Categories", summary.categories], ["Locations", summary.locations],
    ["Metadata records", summary.metadata_records], ["Cover files", summary.cover_files],
    ["Created", new Date(summary.created_at).toLocaleString()], ["Backup version", summary.backup_version],
    ["Source username", summary.source_username],
  ];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      <div className="bg-gray-900 p-6 rounded-xl w-96">
        <h3 className="text-lg mb-3 text-yellow-400 font-semibold">Restore validated backup?</h3>
        <p className="text-sm text-yellow-200 mb-4 font-medium">This will replace your current library data.</p>
        {file && <div className="text-xs text-gray-400 mb-3 truncate">{file.name}</div>}
        <dl className="text-sm mb-5 space-y-1">
          {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-gray-400">{label}</dt><dd className="text-gray-100 text-right">{value}</dd></div>)}
        </dl>
        <div className="flex gap-2">
          <button disabled={restoring} onClick={onConfirm} className={`flex-1 py-2 rounded ${restoring ? "bg-yellow-800 cursor-not-allowed" : "bg-yellow-600 hover:bg-yellow-700"}`}>
            {restoring ? "Restoring..." : "Replace library"}
          </button>
          <button disabled={restoring} onClick={onCancel} className="bg-gray-600 flex-1 py-2 rounded disabled:opacity-60">Cancel</button>
        </div>
      </div>
    </div>
  );
}

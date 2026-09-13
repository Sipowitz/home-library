import { ActionButton } from "../../ui/ActionButton";

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
      <div className="bg-surface border border-border-strong p-6 rounded-xl w-96 text-text-primary shadow-2xl">
        <h3 className="text-lg mb-3 text-warning font-semibold">Restore validated backup?</h3>
        <p className="text-sm text-warning mb-4 font-medium">This will replace your current library data.</p>
        {file && <div className="text-xs text-text-muted mb-3 truncate">{file.name}</div>}
        <dl className="text-sm mb-5 space-y-1">
          {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-text-muted">{label}</dt><dd className="text-text-primary text-right">{value}</dd></div>)}
        </dl>
        <div className="flex gap-2">
          <ActionButton variant="warningStrong" disabled={restoring} onClick={onConfirm} className="flex-1">
            {restoring ? "Restoring..." : "Replace library"}
          </ActionButton>
          <ActionButton variant="tertiary" disabled={restoring} onClick={onCancel} className="flex-1">Cancel</ActionButton>
        </div>
      </div>
    </div>
  );
}

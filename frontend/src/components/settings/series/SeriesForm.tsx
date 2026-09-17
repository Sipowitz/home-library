import { useEffect, useId, useRef, useState } from "react";

import { ActionButton } from "../../ui/ActionButton";

export type SeriesDraft = {
  name: string;
  nodeType: "group" | "series";
  author: string;
  description: string;
  coverUrl: string;
  coverFile: File | null;
  coverCleared: boolean;
  parentId: number | null;
};

type Props = {
  draft: SeriesDraft;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onChange: (draft: SeriesDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function SeriesForm({
  draft,
  saving,
  error,
  submitLabel,
  onChange,
  onCancel,
  onSubmit,
}: Props) {
  const prefix = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.coverFile) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(draft.coverFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.coverFile]);

  const previewUrl = localPreviewUrl ?? draft.coverUrl;
  const hasCover = Boolean(previewUrl);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-muted/35 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-medium text-text-secondary">Cover image</span>
        {hasCover && (
          <img src={previewUrl} alt="Collection cover preview" className="mb-3 h-36 w-24 rounded-lg border border-border object-cover" />
        )}
        <input
          ref={fileInputRef}
          id={`${prefix}-cover-file`}
          aria-label="Cover image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file) onChange({ ...draft, coverFile: file, coverCleared: false });
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <ActionButton type="button" variant="tertiary" onClick={() => fileInputRef.current?.click()} disabled={saving}>
            {hasCover ? "Replace cover" : "Choose cover"}
          </ActionButton>
          {hasCover && (
            <ActionButton type="button" variant="tertiary" onClick={() => onChange({ ...draft, coverUrl: "", coverFile: null, coverCleared: true })} disabled={saving}>
              Remove cover
            </ActionButton>
          )}
        </div>
        <p className="mt-1.5 text-xs text-text-muted">JPEG, PNG or WebP, up to 15 MB.</p>
      </div>

      <div>
        <label htmlFor={`${prefix}-name`} className="mb-1.5 block text-sm font-medium text-text-secondary">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${prefix}-name`}
          autoFocus
          required
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          className="form-control w-full px-3 py-2.5"
        />
      </div>

      <div>
        <label htmlFor={`${prefix}-author`} className="mb-1.5 block text-sm font-medium text-text-secondary">
          Author
        </label>
        <input
          id={`${prefix}-author`}
          value={draft.author}
          onChange={(event) => onChange({ ...draft, author: event.target.value })}
          placeholder="Optional"
          className="form-control w-full px-3 py-2.5"
        />
      </div>

      <div>
        <label htmlFor={`${prefix}-description`} className="mb-1.5 block text-sm font-medium text-text-secondary">
          Description
        </label>
        <textarea
          id={`${prefix}-description`}
          rows={5}
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Optional"
          className="form-control w-full resize-y px-3 py-2.5"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <ActionButton onClick={onCancel} disabled={saving} variant="tertiary" className="sm:min-w-24">
          Cancel
        </ActionButton>
        <ActionButton type="submit" disabled={saving || !draft.name.trim()} variant="primary" className="sm:min-w-24">
          {saving ? "Saving…" : submitLabel}
        </ActionButton>
      </div>
    </form>
  );
}

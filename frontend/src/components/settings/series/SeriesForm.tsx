import { useId } from "react";

import { ActionButton } from "../../ui/ActionButton";

import type { SeriesOption } from "./seriesTree";

export type SeriesDraft = {
  name: string;
  author: string;
  description: string;
  parentId: number | null;
};

type Props = {
  draft: SeriesDraft;
  parentOptions: SeriesOption[];
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onChange: (draft: SeriesDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function SeriesForm({
  draft,
  parentOptions,
  saving,
  error,
  submitLabel,
  onChange,
  onCancel,
  onSubmit,
}: Props) {
  const prefix = useId();

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
        <label htmlFor={`${prefix}-parent`} className="mb-1.5 block text-sm font-medium text-text-secondary">
          Parent Series
        </label>
        <select
          id={`${prefix}-parent`}
          value={draft.parentId ?? ""}
          onChange={(event) =>
            onChange({
              ...draft,
              parentId: event.target.value ? Number(event.target.value) : null,
            })
          }
          className="form-control w-full px-3 py-2.5"
        >
          <option value="">No parent (root Series)</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
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

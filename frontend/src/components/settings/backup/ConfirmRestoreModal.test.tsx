// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ConfirmRestoreModal } from "./ConfirmRestoreModal";

it("uses a padded, constrained shell and stacks restore actions on mobile", () => {
  render(
    <ConfirmRestoreModal
      open
      restoring={false}
      file={null}
      summary={{ books: 1, categories: 0, locations: 0, metadata_records: 0, metadata_snapshots: 0, normalized_metadata_records: 0, cover_files: 0, created_at: "2026-01-01T00:00:00Z", backup_version: 1, source_username: "owner" }}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  const modal = screen.getByText("Restore validated backup?").parentElement;
  const actions = screen.getByRole("button", { name: "Replace library" }).parentElement;
  expect(modal?.classList.contains("w-full")).toBe(true);
  expect(modal?.classList.contains("max-w-sm")).toBe(true);
  expect(actions?.classList.contains("flex-col-reverse")).toBe(true);
  expect(actions?.classList.contains("sm:flex-row")).toBe(true);
});

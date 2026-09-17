// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { SeriesForm, type SeriesDraft } from "./SeriesForm";

const groupDraft: SeriesDraft = {
  name: "Pratchett", nodeType: "group", author: "Terry Pratchett",
  description: "", coverUrl: "", coverFile: null, coverCleared: false, parentId: null,
};

it("keeps an optional Group author in the Settings form", () => {
  const submitted = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState(groupDraft);
    return <SeriesForm draft={draft} saving={false} error={null} submitLabel="Save" onChange={setDraft} onCancel={vi.fn()} onSubmit={() => submitted(draft)} />;
  }
  render(<Harness />);
  const author = screen.getByLabelText("Author");
  expect((author as HTMLInputElement).value).toBe("Terry Pratchett");
  fireEvent.change(author, { target: { value: "  Terry Pratchett  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ nodeType: "group", author: "  Terry Pratchett  " }));
});

it("shows the existing cover and exposes a local image picker for Groups and Series", () => {
  render(
    <SeriesForm
      draft={{ ...groupDraft, coverUrl: "/covers/objects/sha256/ab/example.jpg" }}
      saving={false}
      error={null}
      submitLabel="Save"
      onChange={vi.fn()}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
  expect(screen.getByAltText("Collection cover preview").getAttribute("src")).toBe("/covers/objects/sha256/ab/example.jpg");
  expect(screen.getAllByLabelText("Cover image").at(-1)?.getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
  expect(screen.getByRole("button", { name: "Replace cover" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove cover" })).toBeTruthy();
});

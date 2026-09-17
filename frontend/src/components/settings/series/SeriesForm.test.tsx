// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { SeriesForm, type SeriesDraft } from "./SeriesForm";

const groupDraft: SeriesDraft = {
  name: "Pratchett", nodeType: "group", author: "Terry Pratchett",
  description: "", coverUrl: "", parentId: null,
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

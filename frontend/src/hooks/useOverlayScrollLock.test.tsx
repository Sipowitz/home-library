// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useOverlayScrollLock } from "./useOverlayScrollLock";
import { Dialog } from "../components/ui/Dialog";

function Harness({ open }: { open: boolean }) {
  useOverlayScrollLock(open);
  return null;
}

afterEach(() => {
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
});

it("restores the exact viewport after an overlay closes", () => {
  Object.defineProperty(window, "scrollX", { configurable: true, value: 37 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 842 });
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  const view = render(<Harness open />);

  expect(document.body.style.position).toBe("fixed");
  view.unmount();

  expect(scrollTo).toHaveBeenCalledWith(37, 842);
  expect(document.body.style.position).toBe("");
});

it("keeps the lock through nested overlay transitions", () => {
  Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 512 });
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  function NestedHarness() {
    const [editing, setEditing] = useState(false);
    return <><Harness open /><button onClick={() => setEditing(true)}>{editing ? "editing" : "view"}</button></>;
  }
  const view = render(<NestedHarness />);
  act(() => { view.getByRole("button").click(); });
  expect(document.body.style.position).toBe("fixed");
  expect(scrollTo).not.toHaveBeenCalled();
  view.unmount();
  expect(scrollTo).toHaveBeenCalledWith(0, 512);
});

it("reference-counts separate overlays and restores only after the last closes", () => {
  Object.defineProperty(window, "scrollX", { configurable: true, value: 4 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 256 });
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  function TwoOverlays() {
    const [second, setSecond] = useState(true);
    return <><Harness open /><button onClick={() => setSecond(false)}>close</button>{second && <Harness open />}</>;
  }
  const view = render(<TwoOverlays />);
  act(() => { view.getByRole("button").click(); });
  expect(scrollTo).not.toHaveBeenCalled();
  view.unmount();
  expect(scrollTo).toHaveBeenCalledWith(4, 256);
});

it("applies the same preservation to the shared Dialog used by Library overlays", () => {
  Object.defineProperty(window, "scrollX", { configurable: true, value: 12 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 900 });
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  const onClose = vi.fn();
  const view = render(<Dialog open title="Add Book" onClose={onClose}>Content</Dialog>);
  expect(document.body.style.position).toBe("fixed");
  view.rerender(<Dialog open={false} title="Add Book" onClose={onClose}>Content</Dialog>);
  expect(scrollTo).toHaveBeenCalledWith(12, 900);
});

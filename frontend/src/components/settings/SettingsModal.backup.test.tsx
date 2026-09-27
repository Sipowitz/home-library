// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import client from "../../api/client";
import toast from "react-hot-toast";
import { SettingsModal } from "./SettingsModal";

vi.mock("../../api/client", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../context/LocationContext", () => ({ useLocations: () => ({ locations: [], deleteLocation: vi.fn() }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../../hooks/usePreferences", () => ({ usePreferences: () => ({ preferences: null }) }));
vi.mock("../../hooks/useOverlayScrollLock", () => ({ useOverlayScrollLock: vi.fn() }));
vi.mock("./SettingsSidebar", () => ({ SettingsSidebar: ({ onChange }: { onChange: (section: "backup") => void }) => <button onClick={() => onChange("backup")}>Open backup settings</button> }));
vi.mock("./locations/LocationSettings", () => ({ LocationSettings: () => null }));
vi.mock("./categories/CategorySettings", () => ({ CategorySettings: () => null }));
vi.mock("./series/SeriesSettings", () => ({ SeriesSettings: () => null }));
vi.mock("./preferences/PreferencesSettings", () => ({ PreferencesSettings: () => null }));
vi.mock("./LibrarySettings", () => ({ LibrarySettings: () => null }));
vi.mock("./providers/ProviderSettingsPanel", () => ({ ProviderSettingsPanel: () => null }));
vi.mock("./ConfirmDeleteModal", () => ({ ConfirmDeleteModal: () => null }));
vi.mock("./users/PendingUsersPanel", () => ({ PendingUsersPanel: () => null }));
vi.mock("./maintenance/MaintenanceSettings", () => ({ MaintenanceSettings: () => null }));
vi.mock("./backup/ConfirmRestoreModal", () => ({ ConfirmRestoreModal: () => null }));

const getExport = vi.mocked(client.get);
const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);

function renderBackupSettings() {
  render(
    <SettingsModal
      isOpen
      onClose={vi.fn()}
      onReviewBook={vi.fn()}
      onReviewSequenceComplete={vi.fn()}
      onViewBook={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open backup settings" }));
  return screen.getByRole("button", { name: "Download Backup" }) as HTMLButtonElement;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("SettingsModal backup creation feedback", () => {
  const createObjectURL = vi.fn(() => "blob:test-backup");
  const revokeObjectURL = vi.fn();
  let anchorClick: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getExport.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    anchorClick.mockRestore();
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it("starts normal, announces creation immediately, and prevents duplicate export requests", async () => {
    const pending = deferred<{ data: Blob }>();
    getExport.mockReturnValueOnce(pending.promise);
    const button = renderBackupSettings();

    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("false");

    fireEvent.click(button);

    const creating = screen.getByRole("button", { name: "Creating backup…" }) as HTMLButtonElement;
    expect(creating.disabled).toBe(true);
    expect(creating.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Creating backup…");
    expect(getExport).toHaveBeenCalledTimes(1);
    expect(getExport).toHaveBeenCalledWith("/backup/export", { responseType: "blob" });

    fireEvent.click(creating);
    expect(getExport).toHaveBeenCalledTimes(1);

    pending.resolve({ data: new Blob(["backup"]) });
    await waitFor(() => expect((screen.getByRole("button", { name: "Download Backup" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("initiates the download and restores the normal state after success", async () => {
    getExport.mockResolvedValueOnce({ data: new Blob(["backup"]) });
    const button = renderBackupSettings();

    fireEvent.click(button);

    await waitFor(() => expect((screen.getByRole("button", { name: "Download Backup" }) as HTMLButtonElement).disabled).toBe(false));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-backup");
    expect(toastSuccess).toHaveBeenCalledWith("Backup downloaded");
  });

  it("restores the normal state and existing error feedback after failure", async () => {
    getExport.mockRejectedValueOnce(new Error("export failed"));
    const button = renderBackupSettings();

    fireEvent.click(button);

    await waitFor(() => expect((screen.getByRole("button", { name: "Download Backup" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("status")).toBeNull();
    expect(toastError).toHaveBeenCalledWith("Backup failed");
  });
});

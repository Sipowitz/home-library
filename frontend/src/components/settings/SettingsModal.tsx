import { useEffect, useRef, useState } from "react";

import axios from "axios";

import toast from "react-hot-toast";

import client from "../../api/client";

import { useLocations } from "../../context/LocationContext";

import { formatFileTimestamp } from "../../utils/dateFormatters";

import { SettingsSidebar } from "./SettingsSidebar";

import { BackupSettings } from "./backup/BackupSettings";

import { ConfirmRestoreModal } from "./backup/ConfirmRestoreModal";

import type { BackupValidationSummary } from "./backup/ConfirmRestoreModal";

import { LocationSettings } from "./locations/LocationSettings";

import { CategorySettings } from "./categories/CategorySettings";

import { PreferencesSettings } from "./preferences/PreferencesSettings";

import { ProviderSettingsPanel } from "./providers/ProviderSettingsPanel";

import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

import { PendingUsersPanel } from "./users/PendingUsersPanel";
import { useAuth } from "../../context/AuthContext";
import { MaintenanceSettings, type ReviewTarget } from "./maintenance/MaintenanceSettings";

type Props = {
  isOpen: boolean;

  onClose: () => void;
  onReviewBook: (bookId: number, target: ReviewTarget) => void;
  onReviewSequenceComplete: () => void;
  reviewSaved?: { bookId: number; nonce: number } | null;
};

type Section =
  | "locations"
  | "categories"
  | "providers"
  | "maintenance"
  | "backup"
  | "preferences"
  | "users";

export function SettingsModal({ isOpen, onClose, onReviewBook, onReviewSequenceComplete, reviewSaved }: Props) {
  const { user } = useAuth();
  const { locations, deleteLocation } = useLocations();

  const [activeSection, setActiveSection] = useState<Section>("locations");

  // -------------------
  // ❌ DELETE LOCATION
  // -------------------

  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState<
    number | null
  >(null);

  // -------------------
  // 💾 BACKUP / RESTORE
  // -------------------

  const [restoring, setRestoring] = useState(false);

  const [validatingBackup, setValidatingBackup] = useState(false);

  const [validationToken, setValidationToken] = useState<string | null>(null);

  const [validationSummary, setValidationSummary] = useState<BackupValidationSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  const [lastRestoreAt, setLastRestoreAt] = useState<string | null>(null);

  useEffect(() => {
    setLastBackupAt(localStorage.getItem("last_backup_at"));
    setLastRestoreAt(localStorage.getItem("last_restore_at"));
  }, []);

  // -------------------
  // 💾 BACKUP
  // -------------------

  async function handleBackup() {
    try {
      const res = await client.get("/backup/export", {
        responseType: "blob",
      });

      const blob = res.data;

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      const timestamp = formatFileTimestamp(new Date());

      a.href = url;

      a.download = `library-backup-${timestamp}.lbak`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

      const backupTimestamp = new Date().toISOString();

      localStorage.setItem("last_backup_at", backupTimestamp);

      setLastBackupAt(backupTimestamp);

      toast.success("Backup downloaded");
    } catch (err) {
      console.error("Backup failed", err);

      toast.error("Backup failed");
    }
  }

  // -------------------
  // 📥 RESTORE
  // -------------------

  function backupErrorMessage(err: unknown, fallback: string) {
    if (axios.isAxiosError<{ message?: string; detail?: { message?: string } }>(err)) {
      return err.response?.data?.detail?.message || err.response?.data?.message || fallback;
    }
    return fallback;
  }

  async function handleValidate(file: File) {
    try {
      setValidatingBackup(true);
      const formData = new FormData();
      formData.append("file", file);
      const response = await client.post("/backup/validate", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPendingFile(file);
      setValidationToken(response.data.validation_token);
      setValidationSummary(response.data.summary);
      setConfirmRestoreOpen(true);
    } catch (err) {
      console.error("Backup validation failed", err);
      toast.error(backupErrorMessage(err, "Backup validation failed"));
      setPendingFile(null);
      setValidationToken(null);
      setValidationSummary(null);
    } finally {
      setValidatingBackup(false);
    }
  }

  async function handleRestore() {
    if (!validationToken) return;
    try {
      setRestoring(true);
      await client.post("/backup/restore", { validation_token: validationToken });
      const restoreTimestamp = new Date().toISOString();
      localStorage.setItem("last_restore_at", restoreTimestamp);
      setLastRestoreAt(restoreTimestamp);
      toast.success("Restore complete");
      setTimeout(() => window.location.reload(), 750);
    } catch (err: unknown) {
      console.error("Restore failed", err);
      const code = axios.isAxiosError<{ code?: string; detail?: { code?: string } }>(err)
        ? err.response?.data?.detail?.code || err.response?.data?.code
        : undefined;
      if (code === "RESTORE_VALIDATION_EXPIRED") {
        toast.error("This validation session is no longer usable. Validate the backup again.");
        return;
      }
      const suffix = code === "RESTORE_DB_ROLLBACK" ? " Your current library was left unchanged." : "";
      toast.error(`${backupErrorMessage(err, "Restore failed")}${suffix}`);
    } finally {
      setRestoring(false);
      setConfirmRestoreOpen(false);
      setPendingFile(null);
      setValidationToken(null);
      setValidationSummary(null);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* BACKDROP */}

      <div
        className="
          fixed inset-0 z-[70]
          bg-black/50 backdrop-blur-sm
          flex items-center justify-center
          px-2 sm:px-6 lg:px-16
          py-2 sm:py-6 lg:py-10
        "
        onClick={onClose}
      >
        {/* MODAL */}

        <div
          className="
            bg-gray-950/95
            border border-gray-800
            rounded-xl sm:rounded-2xl
            w-full
            h-full
            shadow-2xl
            overflow-y-auto
            flex flex-col lg:flex-row
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* SIDEBAR */}

          <div
            className="
              bg-gray-900/90
              border-b lg:border-b-0 lg:border-r border-gray-800
              p-2.5 sm:p-3 lg:p-4
              flex flex-col
              lg:w-64
            "
          >
            <div className="mb-2 lg:mb-6">
              <h2 className="text-xl lg:text-2xl font-semibold">Settings</h2>

              <p className="text-sm text-gray-400 mt-1 hidden lg:block">
                Configure your library system
              </p>
            </div>

            <SettingsSidebar
              active={activeSection}
              onChange={setActiveSection}
              isAdmin={Boolean(user?.is_admin)}
            />

            <div className="mt-2 lg:mt-auto lg:pt-4">
              <button
                onClick={onClose}
                className="
                  w-full py-2 rounded-lg
                  bg-gray-800 hover:bg-gray-700
                  transition
                "
              >
                Close
              </button>
            </div>
          </div>

          {/* CONTENT */}

          <div className="min-w-0 p-2 sm:p-3 lg:flex-1 lg:p-6">
            {/* LOCATIONS */}

            {activeSection === "locations" && (
              <div className="max-w-full relative">
                <div className="bg-gray-900/30 sm:bg-gray-900/60 border border-gray-800/70 sm:border-gray-800 rounded-lg sm:rounded-xl p-2.5 sm:p-4 lg:p-5 w-full">
                  <div className="mb-3 lg:mb-5">
                    <h2 className="text-lg font-semibold">Locations</h2>

                    <p className="text-sm text-gray-400 mt-1">
                      Organize where books are physically stored.
                    </p>
                  </div>

                  <LocationSettings locations={locations} />
                </div>
              </div>
            )}

            {/* CATEGORIES */}

            {activeSection === "categories" && (
              <div className="max-w-full relative">
                <div className="bg-gray-900/30 sm:bg-gray-900/60 border border-gray-800/70 sm:border-gray-800 rounded-lg sm:rounded-xl p-2.5 sm:p-4 lg:p-5 w-full">
                  <div className="mb-3 lg:mb-5">
                    <h2 className="text-lg font-semibold">Categories</h2>

                    <p className="text-sm text-gray-400 mt-1">
                      Organize books by subject or collection.
                    </p>
                  </div>

                  <CategorySettings />
                </div>
              </div>
            )}

            {/* PROVIDERS */}

            {activeSection === "maintenance" && (
              <MaintenanceSettings
                active={isOpen}
                reviewSaved={reviewSaved}
                onReview={onReviewBook}
                onReviewSequenceComplete={onReviewSequenceComplete}
              />
            )}

            {activeSection === "providers" && user?.is_admin && (
              <div className="max-w-4xl">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">Providers</h2>

                    <p className="text-sm text-gray-400 mt-1">
                      Configure metadata search providers and priority order.
                    </p>
                  </div>

                  <ProviderSettingsPanel />
                </div>
              </div>
            )}

            {activeSection === "users" && user?.is_admin && (
              <div className="max-w-4xl space-y-4"><div><h2 className="text-lg font-semibold">Users</h2><p className="text-sm text-gray-400 mt-1">Approve or reject pending accounts.</p></div><PendingUsersPanel /></div>
            )}

            {/* PREFERENCES */}

            {activeSection === "preferences" && (
              <div className="max-w-2xl">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 lg:p-5">
                  <div className="mb-3 lg:mb-5">
                    <h2 className="text-lg font-semibold">Preferences</h2>

                    <p className="text-sm text-gray-400 mt-1">
                      Configure how dates and times are shown throughout the
                      library.
                    </p>
                  </div>

                  <PreferencesSettings />
                </div>
              </div>
            )}

            {/* BACKUP */}

            {activeSection === "backup" && (
              <div className="max-w-2xl">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 lg:p-5">
                  <div className="mb-3 lg:mb-5">
                    <h2 className="text-lg font-semibold">Backup & Restore</h2>

                    <p className="text-sm text-gray-400 mt-1">
                      Export or restore your library database.
                    </p>
                  </div>

                  <BackupSettings
                    restoring={restoring}
                    validating={validatingBackup}
                    fileInputRef={fileInputRef}
                    lastBackupAt={lastBackupAt}
                    lastRestoreAt={lastRestoreAt}
                    onBackup={handleBackup}
                    onFileSelect={handleValidate}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RESTORE MODAL */}

      <ConfirmRestoreModal
        open={confirmRestoreOpen}
        restoring={restoring}
        file={pendingFile}
        summary={validationSummary}
        onConfirm={() => {
          if (!validationToken || restoring) return;
          handleRestore();
        }}
        onCancel={() => {
          setConfirmRestoreOpen(false);

          setPendingFile(null);
          setValidationToken(null);
          setValidationSummary(null);
        }}
      />

      {/* DELETE LOCATION */}

      <ConfirmDeleteModal
        open={confirmDeleteLocation !== null}
        title="Delete Location?"
        message="Books in this location will be unassigned."
        onConfirm={async () => {
          if (confirmDeleteLocation === null) {
            return;
          }

          try {
            await deleteLocation(confirmDeleteLocation);
          } catch (err) {
            console.error("DELETE FAILED:", err);
          }

          setConfirmDeleteLocation(null);
        }}
        onCancel={() => setConfirmDeleteLocation(null)}
      />
    </>
  );
}

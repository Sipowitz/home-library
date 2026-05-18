import { useEffect, useRef, useState } from "react";

import toast from "react-hot-toast";

import client from "../../api/client";

import { useLocations } from "../../context/LocationContext";

import { formatFileTimestamp } from "../../utils/dateFormatters";

import { SettingsSidebar } from "./SettingsSidebar";

import { BackupSettings } from "./backup/BackupSettings";

import { ConfirmRestoreModal } from "./backup/ConfirmRestoreModal";

import { LocationSettings } from "./locations/LocationSettings";

import { CategorySettings } from "./categories/CategorySettings";

import { PreferencesSettings } from "./preferences/PreferencesSettings";

import { ProviderSettingsPanel } from "./providers/ProviderSettingsPanel";

import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

import { fetchCategories } from "../../api/categories";

import type { Category } from "../../types/category";

type Props = {
  isOpen: boolean;

  onClose: () => void;
};

type Section =
  | "locations"
  | "categories"
  | "providers"
  | "backup"
  | "preferences";

export function SettingsModal({ isOpen, onClose }: Props) {
  const { locations, deleteLocation } = useLocations();

  const [activeSection, setActiveSection] = useState<Section>("locations");

  // -------------------
  // 🏷 CATEGORIES
  // -------------------

  const [categories, setCategories] = useState<Category[]>([]);

  // -------------------
  // ❌ DELETE LOCATION
  // -------------------

  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState<
    number | null
  >(null);

  // -------------------
  // ❌ DELETE CATEGORY
  // -------------------

  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<
    number | null
  >(null);

  const [categoryDeleteDetails, setCategoryDeleteDetails] = useState<string[]>(
    [],
  );

  // -------------------
  // 💾 BACKUP / RESTORE
  // -------------------

  const [restoring, setRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  const [lastRestoreAt, setLastRestoreAt] = useState<string | null>(null);

  // -------------------
  // 📥 LOAD CATEGORIES
  // -------------------

  useEffect(() => {
    fetchCategories().then(setCategories);

    setLastBackupAt(localStorage.getItem("last_backup_at"));

    setLastRestoreAt(localStorage.getItem("last_restore_at"));
  }, []);

  async function refreshCategories() {
    const data = await fetchCategories();

    setCategories(data);
  }

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

      a.download = `library-backup-${timestamp}.json`;

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

  async function handleRestore(file: File) {
    try {
      setRestoring(true);

      const formData = new FormData();

      formData.append("file", file);

      await client.post("/backup/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const restoreTimestamp = new Date().toISOString();

      localStorage.setItem("last_restore_at", restoreTimestamp);

      setLastRestoreAt(restoreTimestamp);

      toast.success("Restore complete");

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error("Restore failed", err);

      toast.error("Restore failed");
    } finally {
      setRestoring(false);
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
          fixed inset-0 z-50
          bg-black/50 backdrop-blur-sm
          flex items-center justify-center
          px-12 lg:px-16
          py-6 lg:py-10
        "
        onClick={onClose}
      >
        {/* MODAL */}

        <div
          className="
            bg-gray-950/95
            border border-gray-800
            rounded-2xl
            w-full
            h-full
            shadow-2xl
            overflow-hidden
            flex flex-col lg:flex-row
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* SIDEBAR */}

          <div
            className="
              bg-gray-900/90
              border-b lg:border-b-0 lg:border-r border-gray-800
              p-3 lg:p-4
              flex flex-col
              lg:w-64
            "
          >
            <div className="mb-4 lg:mb-6">
              <h2 className="text-xl lg:text-2xl font-semibold">Settings</h2>

              <p className="text-sm text-gray-400 mt-1 hidden lg:block">
                Configure your library system
              </p>
            </div>

            <SettingsSidebar
              active={activeSection}
              onChange={setActiveSection}
            />

            <div className="mt-3 lg:mt-auto lg:pt-4">
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

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col min-h-0">
            {/* LOCATIONS */}

            {activeSection === "locations" && (
              <div className="max-w-full relative flex-1 min-h-0 flex flex-col">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 lg:p-5 flex flex-col flex-1 min-h-0 w-full">
                  <div className="mb-5">
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
              <div className="max-w-full relative flex-1 min-h-0 flex flex-col">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 lg:p-5 flex flex-col flex-1 min-h-0 w-full">
                  <div className="mb-5">
                    <h2 className="text-lg font-semibold">Categories</h2>

                    <p className="text-sm text-gray-400 mt-1">
                      Organize books by subject or collection.
                    </p>
                  </div>

                  <CategorySettings categories={categories} />
                </div>
              </div>
            )}

            {/* PROVIDERS */}

            {activeSection === "providers" && (
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

            {/* PREFERENCES */}

            {activeSection === "preferences" && (
              <div className="max-w-2xl">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 lg:p-5">
                  <div className="mb-5">
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
                  <div className="mb-5">
                    <h2 className="text-lg font-semibold">Backup & Restore</h2>

                    <p className="text-sm text-gray-400 mt-1">
                      Export or restore your library database.
                    </p>
                  </div>

                  <BackupSettings
                    restoring={restoring}
                    fileInputRef={fileInputRef}
                    lastBackupAt={lastBackupAt}
                    lastRestoreAt={lastRestoreAt}
                    onBackup={handleBackup}
                    onFileSelect={(file: File) => {
                      setPendingFile(file);

                      setConfirmRestoreOpen(true);
                    }}
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
        onConfirm={() => {
          if (!pendingFile || restoring) {
            return;
          }

          handleRestore(pendingFile);

          setConfirmRestoreOpen(false);

          setPendingFile(null);
        }}
        onCancel={() => {
          setConfirmRestoreOpen(false);

          setPendingFile(null);
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

      {/* DELETE CATEGORY */}

      <ConfirmDeleteModal
        open={confirmDeleteCategory !== null}
        title="Delete Category Tree?"
        message="Deleting this category will also delete all child categories."
        details={categoryDeleteDetails}
        confirmText="Delete Everything"
        onConfirm={async () => {
          setConfirmDeleteCategory(null);

          setCategoryDeleteDetails([]);

          await refreshCategories();
        }}
        onCancel={() => {
          setConfirmDeleteCategory(null);

          setCategoryDeleteDetails([]);
        }}
      />
    </>
  );
}

import { useState, useEffect, useRef } from "react";
import { useLocations } from "../../context/LocationContext";
import { API } from "../../api/client";
import toast from "react-hot-toast";
import { BackupSettings } from "./BackupSettings";
import { LocationSettings } from "./LocationSettings";
import { CategorySettings } from "./CategorySettings";
import { ConfirmRestoreModal } from "./ConfirmRestoreModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

import {
  fetchCategories,
  createCategory,
  deleteCategory,
} from "../../api/categories";

import type { Category } from "../../api/categories";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsModal({ isOpen, onClose }: Props) {
  const { locations, addLocation, deleteLocation } = useLocations();

  const [newLocation, setNewLocation] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [categoryParentId, setCategoryParentId] = useState<number | "">("");

  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState<
    number | null
  >(null);

  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  // -------------------
  // 📥 LOAD CATEGORIES
  // -------------------
  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  const refreshCategories = async () => {
    const data = await fetchCategories();
    setCategories(data);
  };

  // ✅ USE BACKEND TREE DIRECTLY
  const locationTree = locations;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-gray-900 p-6 rounded-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl mb-4">Settings</h2>

          {/* LOCATIONS */}
          <LocationSettings
            locations={locations}
            locationTree={locationTree}
            newLocation={newLocation}
            setNewLocation={setNewLocation}
            parentId={parentId}
            setParentId={setParentId}
            onAddLocation={async () => {
              if (!newLocation.trim()) return;

              await addLocation(newLocation, parentId || undefined);

              setNewLocation("");
              setParentId("");
            }}
            onDeleteRequest={(id) => setConfirmDeleteLocation(id)}
          />

          {/* CATEGORIES */}
          <CategorySettings
            categories={categories}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            categoryParentId={categoryParentId}
            setCategoryParentId={setCategoryParentId}
            onAddCategory={async () => {
              if (!newCategory.trim()) return;

              await createCategory(newCategory, categoryParentId || undefined);

              setNewCategory("");
              setCategoryParentId("");
              refreshCategories();
            }}
            onDeleteCategory={async (id) => {
              await deleteCategory(id);
              refreshCategories();
            }}
          />

          {/* BACKUP / RESTORE */}
          <BackupSettings
            restoring={restoring}
            fileInputRef={fileInputRef}
            onBackup={handleBackup}
            onFileSelect={(file) => {
              setPendingFile(file);
              setConfirmRestoreOpen(true);
            }}
          />

          <button
            onClick={onClose}
            className="bg-gray-600 w-full py-2 rounded mt-4"
          >
            Close
          </button>
        </div>
      </div>

      {/* RESTORE MODAL */}
      <ConfirmRestoreModal
        open={confirmRestoreOpen}
        restoring={restoring}
        file={pendingFile}
        onConfirm={() => {
          if (!pendingFile || restoring) return;

          handleRestore(pendingFile);
          setConfirmRestoreOpen(false);
          setPendingFile(null);
        }}
        onCancel={() => {
          setConfirmRestoreOpen(false);
          setPendingFile(null);
        }}
      />

      {/* DELETE LOCATION MODAL */}
      <ConfirmDeleteModal
        open={confirmDeleteLocation !== null}
        title="Delete Location?"
        message="Books in this location will be unassigned."
        onConfirm={async () => {
          if (confirmDeleteLocation === null) return;

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

  // ================= BACKUP =================
  async function handleBackup() {
    try {
      const res = await fetch(`${API}/backup/export`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "library-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

      toast.success("Backup downloaded");
    } catch (err) {
      console.error("Backup failed", err);
      toast.error("Backup failed");
    }
  }

  // ================= RESTORE =================
  async function handleRestore(file: File) {
    try {
      setRestoring(true);

      const formData = new FormData();
      formData.append("file", file);

      await fetch(`${API}/backup/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

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
}

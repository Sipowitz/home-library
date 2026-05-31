import React, { useEffect, useMemo, useState } from "react";

import { BookOpen, Save, Sparkles, Trash2 } from "lucide-react";

import type { Book } from "../../types/book";
import type { Category } from "../../types/category";
import type { Location } from "../../types/location";
import type { ProviderResult } from "../../types/provider";

import { CategoryTreeSelector } from "./CategoryTreeSelector";
import { LocationTreeSelector } from "./LocationTreeSelector";
import { FieldLabel } from "./FieldLabel";

import { MetadataComparisonPanel } from "./MetadataComparisonPanel";

import { CoverBrowserModal } from "./CoverBrowserModal";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import { getBook, refreshMetadata } from "../../api/books";

import toast from "react-hot-toast";

import { usePreferencesContext } from "../../context/PreferencesContext";

import { formatDateTime } from "../../utils/dateFormatters";

type Props = {
  editData: Book | null;

  setEditData: (book: Book) => void;

  categories: Category[];

  locations: Location[];

  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  onSave: () => void;

  onCancel: () => void;

  onDelete: () => void;

  onBookUpdated: (book: Book) => void;
};

type CoverCandidate = {
  provider: string;

  label: string;

  url: string;
};

export function BookEdit({
  editData,
  setEditData,
  categories,
  locations,
  textareaRef,
  onSave,
  onCancel,
  onDelete,
  onBookUpdated,
}: Props) {
  const [providers, setProviders] = useState<ProviderResult[]>([]);

  const [uploadedCovers, setUploadedCovers] = useState<CoverCandidate[]>([]);

  const [coverModalOpen, setCoverModalOpen] = useState(false);

  const [showMetadataPanel, setShowMetadataPanel] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedCategoryId = editData?.category_id ?? null;

  const { preferences } = usePreferencesContext();

  // -------------------
  // 📏 AUTO RESIZE
  // -------------------

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";

    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  }, [editData?.description, textareaRef]);

  // -------------------
  // 📥 PROVIDERS
  // -------------------

  useEffect(() => {
    async function load() {
      if (!editData?.id) return;

      try {
        const results = await fetchMetadataCandidates(editData.id);

        setProviders(results);
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, [editData?.id]);

  // -------------------
  // 🖼️ COVERS
  // -------------------

  const allCoverCandidates = useMemo(() => {
    const seen = new Set();

    const merged: CoverCandidate[] = [];

    for (const provider of providers) {
      const data = provider.data || {};

      const covers = data.cover_candidates || [];

      for (const cover of covers) {
        if (!cover.url || seen.has(cover.url)) {
          continue;
        }

        seen.add(cover.url);

        merged.push(cover);
      }
    }

    for (const cover of uploadedCovers) {
      if (!cover.url || seen.has(cover.url)) {
        continue;
      }

      seen.add(cover.url);

      merged.push(cover);
    }

    return merged;
  }, [providers, uploadedCovers]);

  function handleCoverUploaded(cover: CoverCandidate) {
    setUploadedCovers((prev) => [cover, ...prev]);
  }

  // -------------------
  // 🏷️ CATEGORY
  // -------------------

  function handleCategorySelect(id: number | null) {
    const newId = id === -1 ? null : id;

    setEditData({
      ...editData!,
      category_id: newId,
    });
  }

  // -------------------
  // 🖼️ FALLBACK
  // -------------------

  function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;

    if (!img.src.includes("fallback-cover.png")) {
      img.src = "/fallback-cover.png";
    }
  }

  // -------------------
  // 🔄 REFRESH METADATA
  // -------------------

  async function handleRefreshMetadata() {
    if (!editData?.id || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);

      const results = await refreshMetadata(editData.id);

      setProviders(results);

      const updatedBook = await getBook(editData.id);

      setEditData(updatedBook);

      onBookUpdated(updatedBook);

      const successful = results.filter((r) => r.success).length;

      const failed = results.length - successful;

      if (failed === 0) {
        toast.success(
          `Metadata refreshed from ${successful} provider${successful === 1 ? "" : "s"}`,
        );
      } else {
        toast(
          `Refreshed from ${successful} provider${successful === 1 ? "" : "s"} • ${failed} failed`,
        );
      }

      setShowMetadataPanel(true);
    } catch (err) {
      console.error(err);

      toast.error("Metadata refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  }

  const inputClass = `
    w-full
    h-12

    rounded-2xl

    bg-[#0b1727]

    border border-white/10

    px-4

    text-white

    transition-all duration-200

    focus:outline-none
    focus:border-blue-500/40
    focus:bg-[#0e1d31]
  `;

  return (
    <>
      <div className="flex gap-8 h-full">
        {/* ===================================== */}
        {/* LEFT */}
        {/* ===================================== */}

        <div className="w-[150px] flex-shrink-0">
          {/* HEADER */}

          <div className="flex items-center gap-3 mb-4">
            <div
              className="
                w-12 h-12
                rounded-2xl

                bg-blue-500/10
                border border-blue-500/20

                flex items-center justify-center
              "
            >
              <BookOpen size={22} className="text-blue-400" />
            </div>

            <div>
              <h2 className="text-3xl font-bold text-white">Edit Book</h2>

              <p
                className="
                  text-sm
                  text-gray-400
                  mt-0.5
                  leading-relaxed
                "
              >
                Update metadata and details.
              </p>
            </div>
          </div>

          {/* COVER */}

          <button
            type="button"
            onClick={() => setCoverModalOpen(true)}
            className="
              relative
              group
              rounded-3xl
              overflow-hidden
              shadow-2xl
              w-full
            "
          >
            <img
              src={
                editData?.cover_url ||
                "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
              }
              onError={handleImgError}
              className="
                w-full
                object-cover
              "
            />

            {/* OVERLAY */}

            <div
              className="
                absolute inset-0

                bg-black/60

                opacity-0
                group-hover:opacity-100

                transition

                flex items-center justify-center
              "
            >
              <div
                className="
                  px-4 py-2

                  rounded-xl

                  bg-white/10

                  backdrop-blur

                  border border-white/10

                  text-sm
                  text-white
                  font-medium
                "
              >
                Change Cover
              </div>
            </div>
          </button>
        </div>

        {/* ===================================== */}
        {/* RIGHT */}
        {/* ===================================== */}

        <div className="flex-1 flex flex-col min-w-0">
          {/* FORM */}

          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-5">
              {/* TITLE + AUTHOR */}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Title</FieldLabel>

                  <input
                    value={editData?.title || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        title: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>Author</FieldLabel>

                  <input
                    value={editData?.author || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        author: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* SUBTITLE + ISBN */}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Subtitle</FieldLabel>

                  <input
                    value={editData?.subtitle || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        subtitle: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>ISBN</FieldLabel>

                  <input
                    value={editData?.isbn || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        isbn: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* PUBLISHER + LANGUAGE */}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Publisher</FieldLabel>

                  <input
                    value={editData?.publisher || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        publisher: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>Language</FieldLabel>

                  <input
                    value={editData?.language || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        language: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* YEAR + PAGE COUNT */}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Year</FieldLabel>

                  <input
                    value={editData?.year || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        year: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel>Page Count</FieldLabel>

                  <input
                    value={editData?.page_count || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData!,
                        page_count: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* CATEGORY + LOCATION */}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <CategoryTreeSelector
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onSelect={handleCategorySelect}
                    showSpecialOptions={false}
                  />
                </div>

                <div>
                  <LocationTreeSelector
                    locations={locations}
                    selectedLocationId={editData?.location_id ?? null}
                    onSelect={(id) =>
                      setEditData({
                        ...editData!,
                        location_id: id,
                      })
                    }
                  />
                </div>
              </div>

              {/* READ STATUS */}

              <div>
                <FieldLabel>Status</FieldLabel>

                <button
                  type="button"
                  onClick={() =>
                    setEditData({
                      ...editData!,
                      read: !editData?.read,
                    })
                  }
                  className={`
      h-12 px-4 rounded-2xl border
      transition-all duration-200
      ${
        editData?.read
          ? "bg-green-500/10 border-green-500/20 text-green-300"
          : "bg-white/5 border-white/10 text-gray-300"
      }
    `}
                >
                  {editData?.read ? "Read" : "Unread"}
                </button>
              </div>

              {/* METADATA STATUS */}

              <div>
                <FieldLabel>Metadata</FieldLabel>

                <div
                  className="
      rounded-2xl

      bg-[#0b1727]

      border border-white/10

      px-4 py-3

      text-sm
    "
                >
                  <div className="text-gray-400">Last refresh</div>

                  <div className="text-white mt-1">
                    {editData?.last_metadata_refresh_at
                      ? formatDateTime(
                          editData.last_metadata_refresh_at,
                          preferences,
                        )
                      : "Never"}
                  </div>
                </div>
              </div>

              {/* DESCRIPTION */}

              <div>
                <FieldLabel>Description</FieldLabel>

                <textarea
                  ref={textareaRef}
                  rows={8}
                  value={editData?.description || ""}
                  onChange={(e) =>
                    setEditData({
                      ...editData!,
                      description: e.target.value,
                    })
                  }
                  className="
                    w-full

                    min-h-[180px]

                    rounded-2xl

                    bg-[#0b1727]

                    border border-white/10

                    p-4

                    text-white

                    resize-none

                    transition-all duration-200

                    focus:outline-none
                    focus:border-blue-500/40
                    focus:bg-[#0e1d31]
                  "
                />
              </div>
            </div>
          </div>

          {/* ===================================== */}
          {/* FOOTER */}
          {/* ===================================== */}

          <div
            className="
              sticky bottom-0

              mt-6
              pt-5

              border-t border-white/5

              bg-[#08111d]

              flex items-center gap-4
            "
          >
            {/* DELETE */}

            <button
              onClick={onDelete}
              className="
                h-12
                px-5

                rounded-2xl

                border border-red-500/20

                bg-red-500/10

                text-red-300

                flex items-center justify-center gap-2

                transition-all duration-200

                hover:bg-red-500/20
              "
            >
              <Trash2 size={16} />
              Delete
            </button>

            {/* RIGHT ACTIONS */}

            <div className="grid grid-cols-4 gap-3 flex-1">
              <button
                onClick={onCancel}
                className="
                  h-12

                  rounded-2xl

                  bg-white/5

                  border border-white/10

                  text-gray-300

                  transition-all duration-200

                  hover:bg-white/10
                "
              >
                Cancel
              </button>

              <button
                onClick={() => setShowMetadataPanel(true)}
                className="
                  h-12

                  rounded-2xl

                  bg-blue-500/10

                  border border-blue-500/20

                  text-blue-300

                  flex items-center justify-center gap-2

                  transition-all duration-200

                  hover:bg-blue-500/20
                "
              >
                <Sparkles size={16} />
                Compare
              </button>

              <button
                onClick={handleRefreshMetadata}
                disabled={isRefreshing}
                className="
                  h-12

                  rounded-2xl

                  bg-purple-500/10

                  border border-purple-500/20

                  text-purple-300

                  flex items-center justify-center gap-2

                  transition-all duration-200

                  hover:bg-purple-500/20

                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
              >
                <Sparkles size={16} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={onSave}
                className="
                  h-12

                  rounded-2xl

                  bg-blue-600

                  text-white

                  flex items-center justify-center gap-2

                  transition-all duration-200

                  hover:bg-blue-500
                "
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================== */}
      {/* METADATA PANEL */}
      {/* ===================================== */}

      {showMetadataPanel && editData?.id && (
        <MetadataComparisonPanel
          bookId={editData.id}
          currentData={editData || {}}
          onClose={() => setShowMetadataPanel(false)}
          onAdoptField={(field, value) => {
            setEditData({
              ...editData!,
              [field]: value,
            });
          }}
        />
      )}

      {/* ===================================== */}
      {/* COVER MODAL */}
      {/* ===================================== */}

      <CoverBrowserModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        title={editData?.title || "Book Covers"}
        covers={allCoverCandidates}
        selectedCoverUrl={editData?.cover_url}
        onSelectCover={(cover) => {
          setEditData({
            ...editData!,
            cover_url: cover.url,
          });

          setCoverModalOpen(false);
        }}
      />
    </>
  );
}

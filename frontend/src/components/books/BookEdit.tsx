import React, { useEffect, useMemo, useState } from "react";

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

type Props = {
  editData: Book | null;

  setEditData: (book: Book) => void;

  categories: Category[];

  locations: Location[];

  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
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
}: Props) {
  const [providers, setProviders] = useState<ProviderResult[]>([]);

  const [coverModalOpen, setCoverModalOpen] = useState(false);

  // ✅ single category

  const selectedCategoryId = editData?.category_id ?? null;

  // -------------------
  // 📏 AUTO RESIZE
  // -------------------

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";

    textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
  }, [editData?.description, textareaRef]);

  // -------------------
  // 📥 LOAD PROVIDER DATA
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
  // 🖼️ MERGED COVERS
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

    return merged;
  }, [providers]);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;

    if (!img.src.includes("fallback-cover.png")) {
      img.src = "/fallback-cover.png";
    }
  };

  // -------------------
  // 🏷️ CATEGORY HANDLERS
  // -------------------

  function handleCategorySelect(id: number | null) {
    const newId = id === -1 ? null : id;

    setEditData({
      ...editData!,
      category_id: newId,
    });
  }

  return (
    <>
      <div className="space-y-8">
        {/* ===================================== */}
        {/* MAIN EDIT FORM */}
        {/* ===================================== */}

        <div>
          {/* HEADER */}

          <div className="flex gap-5 mb-5">
            {/* COVER */}

            <button
              type="button"
              onClick={() => setCoverModalOpen(true)}
              className="
                relative
                group
                rounded-xl
                overflow-hidden
                flex-shrink-0
              "
            >
              <img
                src={
                  editData?.cover_url ||
                  "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
                }
                onError={handleImgError}
                className="
                  w-32
                  rounded-xl
                  shadow
                  transition
                  group-hover:scale-[1.02]
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
                  flex
                  items-center
                  justify-center
                  text-center
                  p-2
                "
              >
                <div
                  className="
                    text-xs
                    text-white
                    font-medium
                  "
                >
                  Browse Covers
                </div>
              </div>
            </button>

            {/* FORM */}

            <div className="flex-1 space-y-3">
              {/* TITLE */}

              <div>
                <FieldLabel>Title</FieldLabel>

                <input
                  className="
                    w-full p-2
                    bg-gray-700
                    rounded
                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                  value={editData?.title || ""}
                  onChange={(e) =>
                    setEditData({
                      ...editData!,
                      title: e.target.value,
                    })
                  }
                />
              </div>

              {/* AUTHOR */}

              <div>
                <FieldLabel>Author</FieldLabel>

                <input
                  className="
                    w-full p-2
                    bg-gray-700
                    rounded
                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                  value={editData?.author || ""}
                  onChange={(e) =>
                    setEditData({
                      ...editData!,
                      author: e.target.value,
                    })
                  }
                />
              </div>

              {/* STATUS */}

              <div>
                <FieldLabel>Status</FieldLabel>

                <div
                  onClick={() => {
                    const newRead = !editData?.read;

                    setEditData({
                      ...editData!,
                      read: newRead,

                      read_at: newRead ? new Date().toISOString() : null,
                    });
                  }}
                  className="
                    flex items-center
                    gap-2
                    cursor-pointer
                  "
                >
                  <div
                    className={`
                      w-10 h-5
                      flex items-center
                      rounded-full
                      p-1
                      transition
                      ${editData?.read ? "bg-green-600" : "bg-gray-600"}
                    `}
                  >
                    <div
                      className={`
                        bg-white
                        w-4 h-4
                        rounded-full
                        shadow
                        transform
                        transition
                        ${editData?.read ? "translate-x-5" : ""}
                      `}
                    />
                  </div>

                  <span className="text-sm">
                    {editData?.read ? "Read" : "Unread"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* METADATA */}

          <div className="space-y-4 mb-3">
            {/* LOCATION */}

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

            {/* CATEGORY */}

            <div>
              <CategoryTreeSelector
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelect={handleCategorySelect}
                showSpecialOptions={false}
              />
            </div>

            {/* ISBN + YEAR */}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>ISBN</FieldLabel>

                <input
                  className="
                    w-full p-2
                    bg-gray-700
                    rounded
                  "
                  value={editData?.isbn || ""}
                  onChange={(e) =>
                    setEditData({
                      ...editData!,
                      isbn: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <FieldLabel>Year</FieldLabel>

                <input
                  className="
                    w-full p-2
                    bg-gray-700
                    rounded
                  "
                  value={editData?.year || ""}
                  onChange={(e) =>
                    setEditData({
                      ...editData!,
                      year: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* DESCRIPTION */}

          <div>
            <FieldLabel>Description</FieldLabel>

            <textarea
              ref={textareaRef}
              rows={3}
              className="
                w-full p-3
                bg-gray-700
                rounded
                resize-none
              "
              value={editData?.description || ""}
              onChange={(e) => {
                const el = e.target;

                el.style.height = "auto";

                el.style.height = el.scrollHeight + "px";

                setEditData({
                  ...editData!,
                  description: e.target.value,
                });
              }}
            />
          </div>
        </div>

        {/* ===================================== */}
        {/* METADATA COMPARISON */}
        {/* ===================================== */}

        {editData?.id && (
          <div
            className="
              border-t border-gray-800
              pt-6
            "
          >
            <MetadataComparisonPanel bookId={editData.id} />
          </div>
        )}
      </div>

      {/* ===================================== */}
      {/* COVER MODAL */}
      {/* ===================================== */}

      <CoverBrowserModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        title={editData?.title || "Book Covers"}
        covers={allCoverCandidates}
      />
    </>
  );
}

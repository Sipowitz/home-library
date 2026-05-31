import { useRef } from "react";

import { uploadCover } from "../../api/books";

type CoverCandidate = {
  provider: string;

  label: string;

  url: string;
};

type Props = {
  open: boolean;

  onClose: () => void;

  title?: string;

  covers: CoverCandidate[];

  bookId?: number;

  onSelectCover?: (cover: CoverCandidate) => void;

  onCoverUploaded?: (cover: CoverCandidate) => void;

  selectedCoverUrl?: string;
};

export function CoverBrowserModal({
  open,
  onClose,
  title,
  covers,
  bookId,
  onSelectCover,
  onCoverUploaded,
  selectedCoverUrl,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    if (!bookId) {
      return;
    }

    const candidate = await uploadCover(bookId, file);

    onCoverUploaded?.(candidate);
  }

  if (!open) return null;

  return (
    <div
      className="
        fixed inset-0
        z-50
        bg-black/80
        backdrop-blur-sm
        flex
        items-center
        justify-center
        p-4
      "
    >
      <div
        className="
          bg-gray-900
          border border-gray-800
          rounded-2xl
          w-full
          max-w-6xl
          max-h-[90vh]
          overflow-hidden
          flex
          flex-col
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            items-center
            justify-between
            px-6
            py-4
            border-b border-gray-800
          "
        >
          <div>
            <h2 className="text-xl font-semibold">Cover Browser</h2>

            {title && <p className="text-sm text-gray-400 mt-1">{title}</p>}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="
                px-3 py-2
                rounded-lg
                bg-blue-600
                hover:bg-blue-500
                transition
              "
            >
              Upload Cover
            </button>

            <button
              onClick={onClose}
              className="
                px-3 py-2
                rounded-lg
                bg-gray-800
                hover:bg-gray-700
                transition
              "
            >
              Close
            </button>
          </div>
        </div>

        {/* CONTENT */}

        <div
          className="
            overflow-y-auto
            p-6
          "
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="
              image/jpeg,
              image/png,
              image/webp
            "
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];

              if (!file) {
                return;
              }

              await handleUpload(file);

              e.target.value = "";
            }}
          />

          {covers.length === 0 ? (
            <div className="text-gray-400">No covers available.</div>
          ) : (
            <div
              className="
                grid
                grid-cols-2
                md:grid-cols-3
                lg:grid-cols-4
                xl:grid-cols-5
                gap-6
              "
            >
              {covers.map((cover, index) => {
                const selected = selectedCoverUrl === cover.url;

                return (
                  <button
                    key={`${cover.url}-${index}`}
                    type="button"
                    onClick={() => onSelectCover?.(cover)}
                    className="
                      text-left
                      space-y-3
                      group
                    "
                  >
                    <div
                      className={`
                        aspect-[2/3]
                        rounded-xl
                        overflow-hidden
                        bg-black/30
                        border
                        transition
                        ${
                          selected
                            ? "border-blue-500 ring-2 ring-blue-500/40"
                            : "border-gray-800 group-hover:border-gray-600"
                        }
                      `}
                    >
                      <img
                        src={cover.url}
                        alt={`Cover ${index}`}
                        className="
                          w-full
                          h-full
                          object-cover
                          transition
                          group-hover:scale-[1.02]
                        "
                      />
                    </div>

                    <div className="space-y-1">
                      <div
                        className="
                          text-sm
                          font-medium
                          capitalize
                        "
                      >
                        {cover.provider.replace("_", " ")}
                      </div>

                      <div
                        className="
                          text-xs
                          text-gray-400
                        "
                      >
                        {cover.label}
                      </div>

                      {selected && (
                        <div
                          className="
                            text-xs
                            text-blue-400
                            font-medium
                          "
                        >
                          Selected
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

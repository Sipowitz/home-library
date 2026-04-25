import React, { useState } from "react";

export function BookEdit({
  editData,
  setEditData,
  categories,
  selectedCategories,
  setSelectedCategories,
  flatLocations,
  textareaRef,
}: any) {
  const [locationOpen, setLocationOpen] = useState(false);

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev: number[]) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const selectedLocation = flatLocations.find(
    (l: any) => l.id === editData?.location_id,
  );

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.src.includes("fallback-cover.png")) {
      img.src = "/fallback-cover.png";
    }
  };

  return (
    <>
      {/* HEADER */}
      <div className="flex gap-4 mb-4">
        <img
          src={
            editData?.cover_url ||
            "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
          }
          onError={handleImgError}
          className="w-32 rounded"
        />

        <div className="flex-1 space-y-2">
          <input
            className="w-full p-2 bg-gray-700 rounded"
            value={editData?.title || ""}
            onChange={(e) =>
              setEditData({ ...editData, title: e.target.value })
            }
          />

          <input
            className="w-full p-2 bg-gray-700 rounded"
            value={editData?.author || ""}
            onChange={(e) =>
              setEditData({ ...editData, author: e.target.value })
            }
          />

          {/* TOGGLE */}
          <div
            onClick={() => {
              const newRead = !editData?.read;

              setEditData({
                ...editData,
                read: newRead,
                read_at: newRead ? new Date().toISOString() : null,
              });
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div
              className={`w-10 h-5 flex items-center rounded-full p-1 transition ${
                editData?.read ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                  editData?.read ? "translate-x-5" : ""
                }`}
              />
            </div>
            <span>{editData?.read ? "Read" : "Unread"}</span>
          </div>
        </div>
      </div>

      {/* LOCATION */}
      <div className="relative mb-2">
        <div
          onClick={() => setLocationOpen((o) => !o)}
          className="w-full p-2 bg-gray-700 rounded cursor-pointer flex justify-between"
        >
          <span>
            {selectedLocation ? selectedLocation.name : "Select location"}
          </span>
          <span>▾</span>
        </div>

        {locationOpen && (
          <div className="absolute z-50 mt-1 w-full bg-gray-800 rounded shadow max-h-60 overflow-y-auto border border-gray-700">
            {flatLocations.map((loc: any) => {
              const isParent = loc.children?.length > 0;

              return (
                <div
                  key={loc.id}
                  onClick={() => {
                    if (isParent) return;
                    setEditData({
                      ...editData,
                      location_id: loc.id,
                    });
                    setLocationOpen(false);
                  }}
                  className={`px-3 py-2 text-sm ${
                    isParent
                      ? "text-gray-500 font-semibold cursor-default"
                      : "hover:bg-gray-700 cursor-pointer"
                  }`}
                  style={{ paddingLeft: `${8 + loc.level * 16}px` }}
                >
                  {loc.name}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CATEGORIES */}
      <div className="mb-3">
        <div className="text-gray-400 mb-1">Categories</div>
        <div className="max-h-32 overflow-y-auto bg-gray-700 p-2 rounded">
          {categories.map((cat: any) => (
            <label key={cat.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
              />
              {cat.name}
            </label>
          ))}
        </div>
      </div>

      <input
        className="w-full p-2 bg-gray-700 rounded mb-2"
        value={editData?.isbn || ""}
        onChange={(e) => setEditData({ ...editData, isbn: e.target.value })}
      />

      <input
        className="w-full p-2 bg-gray-700 rounded mb-2"
        value={editData?.year || ""}
        onChange={(e) =>
          setEditData({
            ...editData,
            year: Number(e.target.value),
          })
        }
      />

      <textarea
        ref={textareaRef}
        rows={3}
        className="w-full p-2 bg-gray-700 rounded resize-none overflow-hidden"
        value={editData?.description || ""}
        onChange={(e) => {
          const el = e.target;
          el.style.height = "auto";
          el.style.height = el.scrollHeight + "px";

          setEditData({
            ...editData,
            description: e.target.value,
          });
        }}
      />
    </>
  );
}

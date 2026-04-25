import React from "react";

export function BookEdit({
  editData,
  setEditData,
  categories,
  selectedCategories,
  setSelectedCategories,
  flatLocations,
  textareaRef,
}: any) {
  const toggleCategory = (id: number) => {
    setSelectedCategories((prev: number[]) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  return (
    <>
      <input
        className="w-full p-2 bg-gray-700 rounded"
        value={editData?.title || ""}
        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
      />

      <textarea
        ref={textareaRef}
        className="w-full p-2 bg-gray-700 rounded"
        value={editData?.description || ""}
        onChange={(e) =>
          setEditData({ ...editData, description: e.target.value })
        }
      />

      {categories.map((cat: any) => (
        <label key={cat.id}>
          <input
            type="checkbox"
            checked={selectedCategories.includes(cat.id)}
            onChange={() => toggleCategory(cat.id)}
          />
          {cat.name}
        </label>
      ))}
    </>
  );
}

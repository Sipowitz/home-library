import React from "react";

export function BookView({ book, locations }: any) {
  function formatDate(dateString?: string) {
    if (!dateString) return "";
    const d = new Date(dateString);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function flattenTree(nodes: any[]): any[] {
    let result: any[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) {
        result = result.concat(flattenTree(node.children));
      }
    }
    return result;
  }

  function getLocationPath(locations: any[], id?: number): string {
    if (!id) return "";

    const flat = flattenTree(locations);
    const map = new Map(flat.map((l) => [l.id, l]));

    let current = map.get(id);
    const path: string[] = [];

    while (current) {
      path.unshift(current.name);
      current = map.get(current.parent_id);
    }

    return path.join(" > ");
  }

  const locationName = getLocationPath(locations, book.location_id);

  const categoryNames = book.categories?.length
    ? book.categories.map((c: any) => c.name)
    : [];

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
            book.cover_url ||
            "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
          }
          onError={handleImgError}
          className="w-32 rounded shadow"
        />

        <div className="flex-1">
          <h2 className="text-xl font-bold">{book.title}</h2>
          <p className="text-gray-400 mb-2">{book.author}</p>

          <span
            className={`text-xs px-2 py-1 rounded ${
              book.read ? "bg-green-600" : "bg-gray-700"
            }`}
          >
            {book.read ? "Read" : "Unread"}
          </span>
        </div>
      </div>

      {/* METADATA */}
      <div className="mb-4 text-sm space-y-2 border-t border-gray-800 pt-3">
        <div>
          <strong>Location:</strong> {locationName || "—"}
        </div>

        {categoryNames?.length > 0 && (
          <div>
            <strong>Categories:</strong> {categoryNames.join(", ")}
          </div>
        )}

        {book.isbn && (
          <div>
            <strong>ISBN:</strong> {book.isbn}
          </div>
        )}

        {book.year && (
          <div>
            <strong>Year:</strong> {book.year}
          </div>
        )}

        {book.date_added && (
          <div>
            <strong>Added:</strong> {formatDate(book.date_added)}
          </div>
        )}
      </div>

      {/* DESCRIPTION */}
      {book.description && (
        <div className="mb-4 border-t border-gray-800 pt-3">
          <h3 className="text-sm font-semibold mb-1">Description</h3>
          <p className="text-sm text-gray-300 whitespace-pre-line">
            {book.description}
          </p>
        </div>
      )}
    </>
  );
}

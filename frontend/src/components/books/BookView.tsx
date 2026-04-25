import React from "react";

export function BookView({ book, locations }: any) {
  function formatDate(dateString?: string) {
    if (!dateString) return "";
    const d = new Date(dateString);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  function getLocationPath(locations: any[], id?: number): string {
    if (!id) return "";

    const map = new Map(locations.map((l) => [l.id, l]));
    let current = map.get(id);

    const path: string[] = [];

    while (current) {
      path.unshift(current.name);
      current = map.get(current.parent_id);
    }

    return path.join(" > ");
  }

  const locationName = getLocationPath(locations, book.location_id);

  return (
    <>
      <h2 className="text-xl font-bold">{book.title}</h2>
      <p className="text-gray-400">{book.author}</p>

      <div className="mt-3 text-sm">
        <div>Location: {locationName || "—"}</div>
        {book.date_added && <div>Added: {formatDate(book.date_added)}</div>}
      </div>
    </>
  );
}

const cache: Record<string, any> = {};

function cleanISBN(isbn: string) {
  return isbn.replace(/[^0-9X]/gi, "");
}

// ✅ USE RELATIVE API (Caddy handles routing)
const API_BASE = "/api";

export async function fetchBookByISBN(rawIsbn: string) {
  const isbn = cleanISBN(rawIsbn);
  if (!isbn) throw new Error("Invalid ISBN");

  if (cache[isbn]) return cache[isbn];

  let data;

  try {
    const res = await fetch(`${API_BASE}/search/isbn/${isbn}`);

    if (!res.ok) {
      throw new Error("Backend request failed");
    }

    data = await res.json();
  } catch (err) {
    console.error("Backend search failed", err);
    throw new Error("Book not found");
  }

  if (!data) {
    throw new Error("Book not found");
  }

  cache[isbn] = data;
  return data;
}

import client from "./client";

const cache: Record<string, any> = {};

function cleanISBN(isbn: string) {
  return isbn.replace(/[^0-9X]/gi, "");
}

export async function fetchBookByISBN(rawIsbn: string) {
  const isbn = cleanISBN(rawIsbn);
  if (!isbn) throw new Error("Invalid ISBN");

  if (cache[isbn]) return cache[isbn];

  let data;

  try {
    // ✅ USE AXIOS CLIENT (goes through /api proxy + adds token if needed)
    const res = await client.get(`/search/isbn/${isbn}`);
    data = res.data;
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

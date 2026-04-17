const cache: Record<string, any> = {};

function getGoogleApiKey() {
  return localStorage.getItem("google_api_key") || "";
}

function cleanISBN(isbn: string) {
  return isbn.replace(/[^0-9X]/gi, "");
}

function scoreItem(item: any, isbn: string) {
  const info = item.volumeInfo || {};
  let score = 0;

  const ids = info.industryIdentifiers || [];
  if (ids.some((id: any) => cleanISBN(id.identifier) === isbn)) {
    score += 50;
  }

  if (info.imageLinks) score += 20;
  if (info.description) score += 10;
  if (info.publishedDate) score += 5;
  if (info.title) score += 5;
  if (info.authors) score += 5;

  return score;
}

// 🔥 CORE FETCH FUNCTION
async function fetchFromGoogle(isbn: string, useKey: boolean) {
  const key = getGoogleApiKey();

  const url =
    useKey && key
      ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${key}`
      : `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;

  const res = await fetch(url);

  if (!res.ok) throw new Error("Google request failed");

  const data = await res.json();

  if (!data.items) {
    const fallbackUrl =
      useKey && key
        ? `https://www.googleapis.com/books/v1/volumes?q=${isbn}&key=${key}`
        : `https://www.googleapis.com/books/v1/volumes?q=${isbn}`;

    const fallbackRes = await fetch(fallbackUrl);
    return await fallbackRes.json();
  }

  return data;
}

export async function fetchBookByISBN(rawIsbn: string) {
  const isbn = cleanISBN(rawIsbn);
  if (!isbn) throw new Error("Invalid ISBN");

  if (cache[isbn]) return cache[isbn];

  let data;

  // 🔥 TRY WITH API KEY FIRST
  try {
    data = await fetchFromGoogle(isbn, true);
  } catch (err) {
    console.warn("API key failed, retrying without key...");

    try {
      data = await fetchFromGoogle(isbn, false);
    } catch {
      console.error("Google completely failed");
    }
  }

  if (!data?.items?.length) {
    throw new Error("Book not found");
  }

  // ✅ PICK BEST RESULT
  const bestMatch = data.items
    .map((item: any) => ({
      item,
      score: scoreItem(item, isbn),
    }))
    .sort((a: any, b: any) => b.score - a.score)[0].item;

  const book = bestMatch.volumeInfo;

  const extractedISBN =
    book.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")
      ?.identifier || isbn;

  const result = {
    title: book.title || "",
    author: book.authors?.join(", ") || "",
    year: book.publishedDate
      ? Number(book.publishedDate.substring(0, 4))
      : undefined,
    description: book.description || "",
    isbn: extractedISBN,

    cover_url:
      book.imageLinks?.thumbnail?.replace("http://", "https://") ||
      book.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
      "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover",

    read: false,
    location: "",
  };

  cache[isbn] = result;
  return result;
}

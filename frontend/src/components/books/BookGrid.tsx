import React from "react";

type Book = {
  id: number;
  title: string;
  author: string;
  cover_url?: string;
  read?: boolean;
};

type Props = {
  books: Book[];
  onSelect: (book: Book) => void;
};

function BookGridComponent({ books, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-5">
      {books.map((book) => {
        const hasCover = book.cover_url && book.cover_url.trim() !== "";

        return (
          <div
            key={book.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(book);
            }}
            className="cursor-pointer group"
          >
            <div className="relative aspect-[2/3] bg-gray-900 rounded-xl overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1 group-hover:scale-[1.02]">
              {hasCover ? (
                <img
                  src={book.cover_url}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.display = "none";
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col justify-between p-3 bg-gradient-to-br from-gray-800 to-gray-950 text-white">
                  <div className="text-[11px] font-semibold leading-tight line-clamp-4">
                    {book.title}
                  </div>

                  <div className="text-[10px] text-gray-400 line-clamp-2">
                    {book.author}
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />

              {book.read && (
                <div className="absolute top-2 right-2 bg-green-600 text-[10px] px-2 py-0.5 rounded-md shadow">
                  Read
                </div>
              )}
            </div>

            <div className="mt-2 px-1">
              <div className="text-xs font-medium truncate">{book.title}</div>
              <div className="text-[10px] text-gray-400 truncate">
                {book.author}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ✅ prevent unnecessary re-renders
export const BookGrid = React.memo(BookGridComponent);

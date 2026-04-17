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

export function BookGrid({ books, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-5">
      {books.map((book) => (
        <div
          key={book.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(book);
          }}
          className="cursor-pointer group"
        >
          <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1">
            {/* COVER */}
            <img
              src="https://dummyimage.com/300x400/00ff00/000000&text=TEST"
              className="w-full h-full object-cover"
            />

            {/* HOVER OVERLAY */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />

            {/* READ BADGE */}
            {book.read && (
              <div className="absolute top-1 right-1 bg-green-600 text-[10px] px-2 py-0.5 rounded">
                Read
              </div>
            )}
          </div>

          {/* TEXT */}
          <div className="mt-2 px-1">
            <div className="text-xs font-semibold truncate">{book.title}</div>
            <div className="text-[10px] text-gray-400 truncate">
              {book.author}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

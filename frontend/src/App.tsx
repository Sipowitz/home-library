import { useEffect, useState } from "react";
import { getBooks, createBook } from "./api";

type Book = {
  id: number;
  title: string;
  author: string;
};

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

  // Load books
  const loadBooks = () => {
    getBooks().then(setBooks);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  // Add book
  const handleAddBook = async () => {
    if (!title || !author) return;

    await createBook({ title, author });

    setTitle("");
    setAuthor("");

    loadBooks(); // refresh list
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto" }}>
      <h1>📚 My Library</h1>

      {/* ➕ Add Book */}
      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          placeholder="Author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <button onClick={handleAddBook}>Add</button>
      </div>

      {/* 📚 Book List */}
      {books.map((book) => (
        <div
          key={book.id}
          style={{
            padding: 10,
            border: "1px solid #ccc",
            marginBottom: 10,
            borderRadius: 8,
          }}
        >
          <strong>{book.title}</strong>
          <div>{book.author}</div>
        </div>
      ))}
    </div>
  );
}

export default App;

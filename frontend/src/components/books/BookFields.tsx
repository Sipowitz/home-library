type Props = {
  title: string;
  author: string;
  onTitleChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
};

export function BookFields({
  title,
  author,
  onTitleChange,
  onAuthorChange,
}: Props) {
  return (
    <div className="space-y-3">
      <input
        placeholder="Title"
        className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />

      <input
        placeholder="Author"
        className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={author}
        onChange={(e) => onAuthorChange(e.target.value)}
      />
    </div>
  );
}

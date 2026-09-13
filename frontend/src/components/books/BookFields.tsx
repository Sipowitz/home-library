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
        className="form-control w-full rounded-lg p-2"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />

      <input
        placeholder="Author"
        className="form-control w-full rounded-lg p-2"
        value={author}
        onChange={(e) => onAuthorChange(e.target.value)}
      />
    </div>
  );
}

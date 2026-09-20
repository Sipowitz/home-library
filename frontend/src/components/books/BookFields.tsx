type Props = {
  title: string;
  author: string;
  onTitleChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
  disabled?: boolean;
};

export function BookFields({
  title,
  author,
  onTitleChange,
  onAuthorChange,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-3">
      <input
        placeholder="Title"
        className="form-control w-full rounded-lg p-2"
        value={title}
        disabled={disabled}
        onChange={(e) => onTitleChange(e.target.value)}
      />

      <input
        placeholder="Author"
        className="form-control w-full rounded-lg p-2"
        value={author}
        disabled={disabled}
        onChange={(e) => onAuthorChange(e.target.value)}
      />
    </div>
  );
}

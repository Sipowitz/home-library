type Props = {
  coverUrl?: string;
};

export function BookPreview({ coverUrl }: Props) {
  if (!coverUrl) return null;

  return (
    <div className="flex justify-center mb-4">
      <img src={coverUrl} className="w-24 rounded-lg shadow-lg" />
    </div>
  );
}

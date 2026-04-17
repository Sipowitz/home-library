type Props = {
  books: Book[];
};

export function StatsPanel({ books }: Props) {
  const total = books.length;
  const read = books.filter((b) => b.read).length;
  const unread = total - read;

  const readPercent = total ? (read / total) * 100 : 0;

  return (
    <div className="bg-gray-800 p-4 rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Library Stats</h2>

      <div className="flex items-center gap-6">
        {/* PIE CHART */}
        <div className="w-32 h-32 relative">
          <div
            className="w-full h-full rounded-full"
            style={{
              background: `conic-gradient(
                #16a34a ${readPercent}%,
                #374151 ${readPercent}% 100%
              )`,
            }}
          />
          <div className="absolute inset-4 bg-gray-800 rounded-full flex items-center justify-center text-sm">
            {total}
          </div>
        </div>

        {/* STATS TEXT */}
        <div className="space-y-2">
          <div>
            <span className="text-gray-400">Total:</span> {total}
          </div>
          <div>
            <span className="text-green-500">Read:</span> {read}
          </div>
          <div>
            <span className="text-gray-400">Unread:</span> {unread}
          </div>
        </div>
      </div>
    </div>
  );
}

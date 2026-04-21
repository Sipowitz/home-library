import { useEffect, useState } from "react";

type Stats = {
  total_books: number;
  read_books: number;
  unread_books: number;
};

const API_BASE = "http://192.168.1.200:8000";

export function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // ✅ ADDED

  async function fetchStats() {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await res.json();

      setStats({
        total_books: data.total_books,
        read_books: data.read_books,
        unread_books: data.unread_books,
      });
    } catch (err) {
      console.error("Stats fetch failed", err);
    }
  }

  useEffect(() => {
    fetchStats();
  }, [refreshKey]); // ✅ CHANGED (was [])

  useEffect(() => {
    const handler = () => {
      setRefreshKey((k) => k + 1); // ✅ FORCE REFRESH
    };

    window.addEventListener("stats-updated", handler);

    return () => {
      window.removeEventListener("stats-updated", handler);
    };
  }, []);

  if (!stats) {
    return <div className="text-gray-400">Loading stats...</div>;
  }

  const total = stats.total_books;
  const read = stats.read_books;
  const unread = stats.unread_books;

  const readPercent = total ? (read / total) * 100 : 0;

  return (
    <div className="bg-gray-800 p-4 rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Library Stats</h2>

      <div className="flex items-center gap-6">
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

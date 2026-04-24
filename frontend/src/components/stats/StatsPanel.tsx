import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import client from "../../api/client";

type StatItem = {
  name: string;
  count: number;
};

type Stats = {
  total_books: number;
  read_books: number;
  unread_books: number;
  by_category: StatItem[];
  by_location: StatItem[];
  recent_added_7_days: number;
  recent_added_30_days: number;
  recent_reads_7_days: number;
  recent_reads_30_days: number;
};

export function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function fetchStats() {
    try {
      const token = localStorage.getItem("token");
      if (!token) return; // ✅ prevent 401 spam

      const res = await client.get("/stats/");
      setStats(res.data);
    } catch (err) {
      console.error("Stats fetch failed", err);
    }
  }

  useEffect(() => {
    fetchStats();
  }, [refreshKey]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("stats-updated", handler);
    return () => window.removeEventListener("stats-updated", handler);
  }, []);

  if (!stats) {
    return <div className="text-gray-400">Loading stats...</div>;
  }

  const total = stats.total_books;
  const read = stats.read_books;
  const unread = stats.unread_books;

  const readPercent = total ? (read / total) * 100 : 0;

  return (
    <div className="bg-gray-900/80 backdrop-blur border border-gray-800 p-5 rounded-2xl shadow-xl">
      <h2 className="text-lg font-semibold mb-4 tracking-wide">
        Library Stats
      </h2>

      {/* TOP CARDS */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">Total</div>
          <div className="text-xl font-semibold">{total}</div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">Read</div>
          <div className="text-xl font-semibold text-green-500">{read}</div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">Unread</div>
          <div className="text-xl font-semibold">{unread}</div>
        </div>
      </div>

      {/* PROGRESS + RECENT */}
      <div className="flex gap-6 items-center mb-6">
        <div className="w-28 h-28 relative">
          <div
            className="w-full h-full rounded-full"
            style={{
              background: `conic-gradient(
                #16a34a ${readPercent}%,
                #374151 ${readPercent}% 100%
              )`,
            }}
          />
          <div className="absolute inset-3 bg-gray-900 rounded-full flex items-center justify-center text-sm">
            {Math.round(readPercent)}%
          </div>
        </div>

        <div className="text-sm space-y-1">
          <div>
            <span className="text-gray-400">Added (7d):</span>{" "}
            {stats.recent_added_7_days}
          </div>
          <div>
            <span className="text-gray-400">Added (30d):</span>{" "}
            {stats.recent_added_30_days}
          </div>
          <div className="text-green-500">
            Read (7d): {stats.recent_reads_7_days}
          </div>
          <div className="text-green-500">
            Read (30d): {stats.recent_reads_30_days}
          </div>
        </div>
      </div>

      {/* CHART */}
      <div>
        <h3 className="text-sm text-gray-400 mb-2">By Location</h3>

        <div className="w-full h-64 min-h-[250px] bg-gray-800 rounded-xl p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.by_location}>
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

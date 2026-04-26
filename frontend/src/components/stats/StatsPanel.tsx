import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { getBooks } from "../../api/books";

type Book = {
  id: number;
  read?: boolean;
  date_added?: string;
};

export function StatsPanel() {
  const [books, setBooks] = useState<Book[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [ready, setReady] = useState(false); // ✅ FIX: prevents width error

  // -------------------
  // 📥 LOAD DATA
  // -------------------
  async function loadStats() {
    try {
      const data = await getBooks(0, 100, undefined, undefined);

      const items = data?.items ?? [];

      setBooks(items);
      buildChart(items);
    } catch (err) {
      console.error("Failed to load stats", err);
      setBooks([]);
      setChartData([]);
    }
  }

  useEffect(() => {
    loadStats();

    const handler = () => loadStats();
    window.addEventListener("stats-updated", handler);

    return () => window.removeEventListener("stats-updated", handler);
  }, []);

  // ✅ FIX: wait until mounted before rendering chart
  useEffect(() => {
    setReady(true);
  }, []);

  // -------------------
  // 📊 BUILD CUMULATIVE CHART
  // -------------------
  function buildChart(items: Book[]) {
    if (!items || items.length === 0) {
      setChartData([]);
      return;
    }

    const sortedBooks = [...items]
      .filter((b) => b.date_added)
      .sort(
        (a, b) =>
          new Date(a.date_added!).getTime() - new Date(b.date_added!).getTime(),
      );

    let total = 0;
    let read = 0;

    const data: any[] = [];

    sortedBooks.forEach((b) => {
      total += 1;
      if (b.read) read += 1;

      const date = new Date(b.date_added!).toISOString().slice(0, 10);

      data.push({
        date,
        total,
        read,
      });
    });

    setChartData(data);
  }

  const total = books.length;
  const read = books.filter((b) => b.read).length;
  const unread = total - read;

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
      <h2 className="text-lg mb-4">Library Stats</h2>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* STATS */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          <StatCard label="Total" value={total} />
          <StatCard label="Read" value={read} highlight />
          <StatCard label="Unread" value={unread} />
        </div>

        {/* CHART */}
        <div className="flex-1">
          <div className="w-full h-[180px]">
            {ready && ( // ✅ FIX HERE
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="read"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className="text-sm text-gray-400">{label}</div>
      <div
        className={`text-xl font-semibold ${
          highlight ? "text-green-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

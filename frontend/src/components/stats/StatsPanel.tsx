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

type ChartPoint = {
  date: string;
  total: number;
  read: number;
};

export function StatsPanel() {
  const [books, setBooks] = useState<Book[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

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

    const data: ChartPoint[] = [];

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

  // -------------------
  // 📊 BASIC STATS
  // -------------------
  const total = books.length;
  const read = books.filter((b) => b.read).length;
  const unread = total - read;

  // -------------------
  // 📅 TIME WINDOWS
  // -------------------
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  const last7 = books.filter(
    (b) => b.date_added && new Date(b.date_added).getTime() >= now - 7 * DAY,
  );

  const last30 = books.filter(
    (b) => b.date_added && new Date(b.date_added).getTime() >= now - 30 * DAY,
  );

  const added7 = last7.length;
  const read7 = last7.filter((b) => b.read).length;

  const added30 = last30.length;
  const read30 = last30.filter((b) => b.read).length;

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
      <h2 className="text-lg mb-4">Library Stats</h2>

      <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 items-stretch">
        {/* STATS */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* TOTALS */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total" value={total} />
            <StatCard label="Read" value={read} highlight />
            <StatCard label="Unread" value={unread} />
          </div>

          {/* LAST 7 DAYS */}
          <ActivityBox title="Last 7 days" added={added7} read={read7} />

          {/* LAST 30 DAYS */}
          <ActivityBox title="Last 30 days" added={added30} read={read30} />
        </div>

        {/* CHART */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 outline-none focus:outline-none">
            {/* LEGEND */}
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
              <LegendItem color="#60a5fa" label="Total books" />
              <LegendItem color="#4ade80" label="Read books" />
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.05} />

                <XAxis
                  dataKey="date"
                  tickFormatter={(value, index) => {
                    if (index % Math.ceil(chartData.length / 5 || 1) !== 0)
                      return "";

                    const date = new Date(value);
                    return date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis hide />

                <Tooltip content={<CustomTooltip />} />

                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#60a5fa"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                />

                <Line
                  type="monotone"
                  dataKey="read"
                  stroke="#4ade80"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
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
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center backdrop-blur">
      <div className="text-xs text-gray-400 uppercase tracking-wide">
        {label}
      </div>

      <div
        className={`text-2xl font-semibold mt-1 ${
          highlight ? "text-green-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ActivityBox({
  title,
  added,
  read,
}: {
  title: string;
  added: number;
  read: number;
}) {
  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 text-sm">
      <div className="text-xs text-gray-400 mb-2">{title}</div>

      <div className="flex justify-between">
        <span className="text-gray-400">Books added</span>
        <span className="text-blue-400">+{added}</span>
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-gray-400">Books read</span>
        <span className="text-green-400">+{read}</span>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const date = new Date(label).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const total = payload.find((p: any) => p.dataKey === "total")?.value ?? 0;
  const read = payload.find((p: any) => p.dataKey === "read")?.value ?? 0;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm shadow-lg">
      <div className="text-gray-400 mb-1 text-xs">{date}</div>

      <div className="flex justify-between gap-6">
        <span className="text-blue-400">Total</span>
        <span className="text-white">{total}</span>
      </div>

      <div className="flex justify-between gap-6">
        <span className="text-green-400">Read</span>
        <span className="text-white">{read}</span>
      </div>
    </div>
  );
}

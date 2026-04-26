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

type Range = "7d" | "30d" | "all";

export function StatsPanel() {
  const [books, setBooks] = useState<Book[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [range, setRange] = useState<Range>("30d");

  async function loadStats() {
    try {
      const data = await getBooks(0, 100, undefined, undefined);
      const items = data?.items ?? [];
      setBooks(items);
    } catch (err) {
      console.error("Failed to load stats", err);
      setBooks([]);
    }
  }

  useEffect(() => {
    loadStats();

    const handler = () => loadStats();
    window.addEventListener("stats-updated", handler);

    return () => window.removeEventListener("stats-updated", handler);
  }, []);

  // -------------------
  // 📈 CHART ONLY FILTER
  // -------------------
  useEffect(() => {
    let filtered = [...books];

    if (range !== "all") {
      const now = Date.now();
      const days = range === "7d" ? 7 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;

      filtered = filtered.filter(
        (b) => b.date_added && new Date(b.date_added).getTime() >= cutoff,
      );
    }

    const sorted = filtered
      .filter((b) => b.date_added)
      .sort(
        (a, b) =>
          new Date(a.date_added!).getTime() - new Date(b.date_added!).getTime(),
      );

    let total = 0;
    let read = 0;

    const data: ChartPoint[] = [];

    sorted.forEach((b) => {
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
  }, [books, range]);

  // -------------------
  // 📊 TOTALS (ALL TIME)
  // -------------------
  const total = books.length;
  const read = books.filter((b) => b.read).length;
  const unread = total - read;

  // -------------------
  // 📅 FIXED ACTIVITY
  // -------------------
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  const last7 = books.filter(
    (b) => b.date_added && new Date(b.date_added).getTime() >= now - 7 * DAY,
  );

  const last30 = books.filter(
    (b) => b.date_added && new Date(b.date_added).getTime() >= now - 30 * DAY,
  );

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg">Library Stats</h2>

        {/* ✅ NOW ONLY AFFECTS CHART */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg text-xs">
          {(["7d", "30d", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 rounded ${
                range === r ? "bg-gray-700 text-white" : "text-gray-400"
              }`}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 items-stretch">
        {/* STATS */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* TOTALS */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total" value={total} />
            <StatCard label="Read" value={read} highlight />
            <StatCard label="Unread" value={unread} />
          </div>

          {/* FIXED ACTIVITY */}
          <ActivityBox
            title="Last 7 days"
            added={last7.length}
            read={last7.filter((b) => b.read).length}
          />

          <ActivityBox
            title="Last 30 days"
            added={last30.length}
            read={last30.filter((b) => b.read).length}
          />
        </div>

        {/* CHART */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3">
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

/* --- helpers unchanged --- */

function StatCard({ label, value, highlight }: any) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
      <div className="text-xs text-gray-400 uppercase">{label}</div>
      <div className={`text-2xl ${highlight ? "text-green-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function ActivityBox({ title, added, read }: any) {
  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 text-sm">
      <div className="text-xs text-gray-400 mb-2">{title}</div>

      <div className="flex justify-between">
        <span>Books added</span>
        <span className="text-blue-400">+{added}</span>
      </div>

      <div className="flex justify-between">
        <span>Books read</span>
        <span className="text-green-400">+{read}</span>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: any) {
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
  if (!active || !payload) return null;

  const date = new Date(label).toLocaleDateString();

  return (
    <div className="bg-gray-800 p-2 rounded text-sm">
      <div>{date}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

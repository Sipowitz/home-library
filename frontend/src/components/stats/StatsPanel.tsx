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

import { getStats } from "../../api/stats";

import { useAuth } from "../../context/AuthContext";

import { usePreferences } from "../../hooks/usePreferences";

import { formatDate } from "../../utils/dateFormatters";

import type { Preferences } from "../../types/preferences";

import type { LibraryStats } from "../../types/stats";

type ChartPoint = {
  date: string;

  total: number;

  read: number;
};

type Range = "7d" | "30d" | "all";

type StatCardProps = {
  label: string;

  value: number;

  highlight?: boolean;
};

type ActivityBoxProps = {
  title: string;

  added: number;

  read: number;
};

type LegendItemProps = {
  color: string;

  label: string;
};

type TooltipPayloadItem = {
  name: string;

  value: number;

  dataKey: string;
};

type CustomTooltipProps = {
  active?: boolean;

  payload?: TooltipPayloadItem[];

  label?: string;

  preferences: Preferences | null;
};

export function StatsPanel() {
  const [stats, setStats] = useState<LibraryStats | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const [range, setRange] = useState<Range>("30d");

  const { ready, token } = useAuth();

  const { preferences } = usePreferences();

  async function loadStats() {
    setIsLoading(true);
    setError(null);

    try {
      setStats(await getStats());
    } catch (err) {
      console.error("Failed to load stats", err);
      setStats(null);
      setError("Statistics could not be loaded");
    } finally {
      setIsLoading(false);
    }
  }

  // -------------------
  // ✅ WAIT FOR AUTH
  // -------------------

  useEffect(() => {
    if (!ready || !token) {
      return;
    }

    loadStats();

    const handler = () => loadStats();

    window.addEventListener("stats-updated", handler);

    return () => window.removeEventListener("stats-updated", handler);
  }, [ready, token]);

  // -------------------
  // 📈 CHART FILTERING
  // -------------------

  useEffect(() => {
    if (!stats) {
      setChartData([]);
      return;
    }

    let filtered = [...stats.books_over_time];

    if (range !== "all") {
      const now = Date.now();

      const days = range === "7d" ? 7 : 30;

      const cutoff = now - days * 24 * 60 * 60 * 1000;

      filtered = filtered.filter((item) => {
        const endOfDay = new Date(`${item.date}T23:59:59.999Z`).getTime();
        return endOfDay >= cutoff;
      });
    }

    let total = 0;

    let read = 0;

    const data: ChartPoint[] = [];

    filtered.forEach((item) => {
      total += item.added_books;
      read += item.read_books;

      data.push({
        date: item.date,
        total,
        read,
      });
    });

    setChartData(data);
  }, [stats, range]);

  // -------------------
  // 📊 TOTALS
  // -------------------

  if (isLoading && !stats) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
        Loading statistics...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-danger">
        {error ?? "Statistics could not be loaded"}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 text-text-primary">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg">Library Stats</h2>

        <div className="flex gap-1 rounded-lg bg-control p-1 text-xs">
          {(["7d", "30d", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 rounded ${
                range === r
                  ? "bg-surface-raised text-text-primary shadow-sm ring-1 ring-border-strong"
                  : "text-text-muted hover:text-text-secondary"
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
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total" value={stats.total_books} />

            <StatCard label="Read" value={stats.read_books} highlight />

            <StatCard label="Unread" value={stats.unread_books} />
          </div>

          <ActivityBox
            title="Last 7 days"
            added={stats.recent_added_7_days}
            read={stats.recent_reads_7_days}
          />

          <ActivityBox
            title="Last 30 days"
            added={stats.recent_added_30_days}
            read={stats.recent_reads_30_days}
          />
        </div>

        {/* CHART */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-control/40 p-3">
            <div className="mb-3 flex items-center gap-4 text-xs text-text-muted">
              <LegendItem color="#60a5fa" label="Total books" />

              <LegendItem color="#4ade80" label="Read books" />
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid
                  stroke="rgb(var(--color-border-strong))"
                  strokeDasharray="3 3"
                  opacity={0.35}
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={(value, index) => {
                    if (index % Math.ceil(chartData.length / 5 || 1) !== 0) {
                      return "";
                    }

                    return formatDate(value, preferences);
                  }}
                  stroke="rgb(var(--color-text-muted))"
                  tick={{
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis hide />

                <Tooltip
                  content={<CustomTooltip preferences={preferences} />}
                />

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

/* --- helpers --- */

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-control/60 p-3 text-center">
      <div className="text-xs uppercase text-text-muted">{label}</div>

      <div className={`text-2xl ${highlight ? "text-success" : "text-text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function ActivityBox({ title, added, read }: ActivityBoxProps) {
  return (
    <div className="rounded-xl border border-border bg-control/40 p-3 text-sm text-text-secondary">
      <div className="mb-2 text-xs text-text-muted">{title}</div>

      <div className="flex justify-between">
        <span>Books added</span>

        <span className="text-blue-600 dark:text-blue-400">+{added}</span>
      </div>

      <div className="flex justify-between">
        <span>Books read</span>

        <span className="text-success">+{read}</span>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />

      <span>{label}</span>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  preferences,
}: CustomTooltipProps) {
  if (!active || !payload || !label) {
    return null;
  }

  return (
    <div className="rounded border border-border-strong bg-surface-raised p-2 text-sm text-text-secondary shadow-lg">
      <div className="font-medium text-text-primary">{formatDate(label, preferences)}</div>

      {payload.map((p) => (
        <div key={p.dataKey}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

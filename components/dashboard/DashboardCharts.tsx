"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatMoney } from "@/lib/format";

// Brand-led palette with matching gradient stops for a soft "3D" depth.
const PALETTE = [
  { solid: "#6366f1", from: "#818cf8", to: "#4f46e5" },
  { solid: "#8b5cf6", from: "#a78bfa", to: "#7c3aed" },
  { solid: "#ec4899", from: "#f472b6", to: "#db2777" },
  { solid: "#f59e0b", from: "#fbbf24", to: "#d97706" },
  { solid: "#10b981", from: "#34d399", to: "#059669" },
  { solid: "#3b82f6", from: "#60a5fa", to: "#2563eb" },
];

function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      cornerRadius={6}
      fill={fill}
    />
  );
}

export function CategoryDonut({
  data,
  currency = "INR",
}: {
  data: { name: string; value: number }[];
  currency?: string;
}) {
  const [active, setActive] = useState<number | undefined>(undefined);
  if (!data.length) {
    return (
      <div className="h-32 flex items-center justify-center text-slate-400 text-xs">No data yet</div>
    );
  }
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <div className="relative">
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <defs>
              {PALETTE.map((p, i) => (
                <linearGradient key={i} id={`donut-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={p.from} />
                  <stop offset="100%" stopColor={p.to} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={3}
              cornerRadius={6}
              dataKey="value"
              stroke="none"
              activeIndex={active}
              activeShape={ActiveSlice}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(undefined)}
              style={{ filter: "drop-shadow(0 6px 14px rgba(79,70,229,0.25))" }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={`url(#donut-${i % PALETTE.length})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center total */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Total</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {formatMoney(total, currency)}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 mt-3">
        {data.slice(0, 4).map((c, i) => (
          <div key={c.name} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length].solid }} />
              <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">{c.name}</span>
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {formatMoney(c.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// Horizontal "where your money goes" — spend by category, monthly-equivalent.
export function CategoryBars({
  data,
  currency = "INR",
}: {
  data: { name: string; value: number }[];
  currency?: string;
}) {
  if (!data.length) {
    return <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No category data yet</div>;
  }
  const rows = data.slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="catBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={92}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
          formatter={(v: number) => [formatMoney(v, currency), "Spend"]}
          contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid rgb(148 163 184 / 0.2)" }}
        />
        <Bar dataKey="value" fill="url(#catBar)" radius={[0, 6, 6, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// "Next months outflow" — projected per-month total as bars.
export function OutflowBars({
  data,
  currency = "INR",
}: {
  data: { month: string; amount: number }[];
  currency?: string;
}) {
  if (!data.length) {
    return <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No upcoming outflow</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="outflowBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.15)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
          formatter={(v: number) => [formatMoney(v, currency), "Outflow"]}
          contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid rgb(148 163 184 / 0.2)" }}
        />
        <Bar dataKey="amount" fill="url(#outflowBar)" radius={[6, 6, 0, 0]} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyTrend({
  data,
  currency = "INR",
}: {
  data: { month: string; amount: number; projected?: boolean }[];
  currency?: string;
}) {
  if (!data.length) {
    return (
      <div className="h-36 flex items-center justify-center text-slate-400 text-xs">No data yet</div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.15)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis hide />
        <Tooltip
          cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }}
          formatter={(v: number) => [formatMoney(v, currency), "Spend"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 10,
            border: "1px solid rgb(148 163 184 / 0.2)",
            boxShadow: "0 8px 24px rgba(15,15,15,0.12)",
          }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="url(#trendStroke)"
          strokeWidth={2.5}
          fill="url(#trendFill)"
          dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
          style={{ filter: "drop-shadow(0 8px 16px rgba(99,102,241,0.2))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

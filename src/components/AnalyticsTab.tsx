import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Budget,
  CATEGORY_COLORS,
  Transaction,
  computeCategoryBreakdown,
  computeDailyCumulativeSeries,
  computeInsights,
  computeSummaryMetrics,
  formatIndianCurrency,
  formatMonthLabel,
  previousMonthKey,
} from '../domain/finpilotStore';
import { SpotlightSurface } from './SpotlightSurface';

interface AnalyticsTabProps {
  transactions: Transaction[];
  budgets: Budget[];
  selectedMonth: string;
  availableMonths: string[];
  currencySymbol: string;
  onSelectMonth: (month: string) => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  transactions,
  budgets,
  selectedMonth,
  availableMonths,
  currencySymbol,
  onSelectMonth,
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const breakdown = useMemo(
    () => computeCategoryBreakdown(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const totalSpentPaise = useMemo(
    () => breakdown.reduce((acc, item) => acc + item.amountPaise, 0),
    [breakdown]
  );

  const insights = useMemo(
    () => computeInsights(transactions, budgets, selectedMonth, currencySymbol),
    [transactions, budgets, selectedMonth, currencySymbol]
  );

  const dailySeries = useMemo(
    () => computeDailyCumulativeSeries(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const sixMonthSeries = useMemo(() => {
    const arr: Array<{
      month: string;
      label: string;
      incomePaise: number;
      expensePaise: number;
    }> = [];
    let cursor = selectedMonth;
    for (let i = 0; i < 6; i++) {
      const m = computeSummaryMetrics(transactions, cursor);
      arr.unshift({
        month: cursor,
        label: formatMonthLabel(cursor),
        incomePaise: m.incomePaise,
        expensePaise: m.expensePaise,
      });
      cursor = previousMonthKey(cursor);
    }
    return arr;
  }, [transactions, selectedMonth]);

  const maxBarPaise = Math.max(
    1,
    ...sixMonthSeries.flatMap((s) => [s.incomePaise, s.expensePaise])
  );

  // Donut SVG geometry
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let cumulativeAngleRatio = 0;

  const focusedSlice = useMemo(
    () => breakdown.find((b) => b.category === activeCategory) || null,
    [breakdown, activeCategory]
  );

  // Daily cumulative SVG path geometry
  const chartW = 720;
  const chartH = 195;
  const maxCumPaise = Math.max(
    1,
    ...dailySeries.map((d) => d.cumulativePaise)
  );
  const points = dailySeries.map((d, idx) => {
    const x =
      dailySeries.length > 1
        ? (idx / (dailySeries.length - 1)) * (chartW - 48) + 24
        : chartW / 2;
    const y =
      chartH - 26 - (d.cumulativePaise / maxCumPaise) * (chartH - 52);
    return { x, y, ...d };
  });

  const linePath =
    points.length > 0
      ? points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' ')
      : '';
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${chartH - 26} L${points[0].x.toFixed(1)},${chartH - 26} Z`
      : '';

  const inspectedPoint = useMemo(() => {
    if (hoveredDay !== null) {
      return points.find((p) => p.day === hoveredDay) || points[points.length - 1];
    }
    return points[points.length - 1] || null;
  }, [points, hoveredDay]);

  return (
    <div className="space-y-6">
      {/* Row 1: Interactive Month Selector Pills + Computed Intelligence Cards */}
      <SpotlightSurface className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Computed Financial Insights
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live analytical synthesis computed from category weights, month-over-month deltas, and budget limits
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="analytics-month-select"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Analysis Month:
            </label>
            <select
              id="analytics-month-select"
              value={selectedMonth}
              onChange={(e) => {
                setActiveCategory(null);
                onSelectMonth(e.target.value);
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none tabular-nums"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m} ({formatMonthLabel(m)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {insights.map((text, idx) => (
            <motion.div
              key={`${selectedMonth}-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.06 }}
              className="rounded-xl bg-slate-50 dark:bg-[#141D31] p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800"
            >
              {text}
            </motion.div>
          ))}
        </div>
      </SpotlightSurface>

      {/* Row 2: Interactive Exploding Donut Chart + 6-Month Grouped Comparison */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Interactive Donut Chart with Dynamic Centre Lens */}
        <SpotlightSurface
          delay={0.08}
          className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Expenses by Category ({formatMonthLabel(selectedMonth)})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hover or click any arc or category row to isolate spend share
              </p>
            </div>
            {activeCategory && (
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="text-xs font-semibold text-indigo-500 hover:underline cursor-pointer"
              >
                Reset Lens
              </button>
            )}
          </div>

          {breakdown.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              No expenses recorded in {formatMonthLabel(selectedMonth)}.
            </div>
          ) : (
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative flex items-center justify-center shrink-0">
                <svg
                  width="206"
                  height="206"
                  viewBox="0 0 206 206"
                  data-testid="analytics-donut-chart"
                >
                  <g transform="rotate(-90 103 103)">
                    {breakdown.map((item) => {
                      const ratio =
                        totalSpentPaise > 0 ? item.amountPaise / totalSpentPaise : 0;
                      const strokeDasharray = `${(ratio * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
                      const strokeDashoffset = (
                        -cumulativeAngleRatio * circumference
                      ).toFixed(2);
                      cumulativeAngleRatio += ratio;
                      const color = CATEGORY_COLORS[item.category] || '#6366F1';
                      const isFocused = activeCategory === item.category;
                      const isDimmed =
                        activeCategory !== null && activeCategory !== item.category;

                      return (
                        <circle
                          key={item.category}
                          cx="103"
                          cy="103"
                          r={radius}
                          fill="transparent"
                          stroke={color}
                          strokeWidth={isFocused ? 30 : 22}
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          opacity={isDimmed ? 0.35 : 1}
                          className="transition-all duration-200 cursor-pointer"
                          onMouseEnter={() => setActiveCategory(item.category)}
                          onClick={() =>
                            setActiveCategory((prev) =>
                              prev === item.category ? null : item.category
                            )
                          }
                        />
                      );
                    })}
                  </g>
                </svg>

                {/* Dynamic Centre Interactive Lens */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 truncate max-w-[110px]">
                    {focusedSlice ? focusedSlice.category : 'Total Spent'}
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {formatIndianCurrency(
                      focusedSlice ? focusedSlice.amountPaise : totalSpentPaise,
                      currencySymbol
                    )}
                  </span>
                  {focusedSlice && (
                    <span className="font-mono text-[11px] font-semibold text-indigo-400 tabular-nums">
                      {focusedSlice.percentage.toFixed(1)}% share
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 w-full space-y-1.5">
                {breakdown.slice(0, 7).map((item) => {
                  const color = CATEGORY_COLORS[item.category] || '#6366F1';
                  const isFocused = activeCategory === item.category;
                  return (
                    <div
                      key={item.category}
                      onMouseEnter={() => setActiveCategory(item.category)}
                      onMouseLeave={() => setActiveCategory(null)}
                      onClick={() =>
                        setActiveCategory((prev) =>
                          prev === item.category ? null : item.category
                        )
                      }
                      className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        isFocused
                          ? 'bg-indigo-500/15 text-slate-900 dark:text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-[#162036]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.category}
                        </span>
                      </div>
                      <div className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {formatIndianCurrency(item.amountPaise, currencySymbol)} ·{' '}
                        <span className="text-slate-400">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SpotlightSurface>

        {/* Interactive Grouped Bar Chart: Click any month to switch */}
        <SpotlightSurface
          delay={0.12}
          className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Income vs Expenses by Month
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any month bar pair to focus analytics on that period
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                  Income
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" />
                  Expense
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-6 gap-3 items-end h-44 pt-4 border-b border-slate-200 dark:border-slate-800">
              {sixMonthSeries.map((s) => {
                const incH = Math.max(
                  6,
                  Math.round((s.incomePaise / maxBarPaise) * 140)
                );
                const expH = Math.max(
                  6,
                  Math.round((s.expensePaise / maxBarPaise) * 140)
                );
                const isSelected = s.month === selectedMonth;

                return (
                  <div
                    key={s.month}
                    onClick={() => onSelectMonth(s.month)}
                    className={`flex flex-col items-center p-1.5 rounded-xl transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-500/10'
                        : 'hover:bg-slate-100 dark:hover:bg-[#162036]'
                    }`}
                  >
                    <div className="flex items-end justify-center gap-1.5 h-36 w-full">
                      <motion.div
                        title={`${s.label} Income: ${formatIndianCurrency(s.incomePaise, currencySymbol)}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${incH}px` }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className="w-3.5 sm:w-4 rounded-t bg-emerald-500"
                      />
                      <motion.div
                        title={`${s.label} Expense: ${formatIndianCurrency(s.expensePaise, currencySymbol)}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${expH}px` }}
                        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
                        className="w-3.5 sm:w-4 rounded-t bg-rose-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-6 gap-3 text-center">
              {sixMonthSeries.map((s) => (
                <button
                  key={s.month}
                  type="button"
                  onClick={() => onSelectMonth(s.month)}
                  className={`font-mono text-xs tabular-nums cursor-pointer ${
                    s.month === selectedMonth
                      ? 'font-bold text-indigo-500'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </SpotlightSurface>
      </div>

      {/* Row 3: Interactive Magnetic Scrubber on Daily Cumulative Spend Trajectory */}
      <SpotlightSurface
        delay={0.16}
        className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Daily Cumulative Spending Trajectory ({formatMonthLabel(selectedMonth)})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scrub across Day 1 to Day {dailySeries.length} to inspect daily burn velocity
            </p>
          </div>

          {inspectedPoint && (
            <div className="flex items-center gap-4 rounded-xl bg-slate-100 dark:bg-[#162036] px-4 py-2 border border-slate-200/80 dark:border-slate-700/70 text-xs font-mono tabular-nums">
              <span className="text-slate-500 dark:text-slate-400">
                Day <strong className="text-slate-900 dark:text-white">{inspectedPoint.day}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                Day Spend:{' '}
                <strong className="text-rose-500">
                  {formatIndianCurrency(inspectedPoint.dailyPaise, currencySymbol)}
                </strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                Cumulative:{' '}
                <strong className="text-indigo-500">
                  {formatIndianCurrency(inspectedPoint.cumulativePaise, currencySymbol)}
                </strong>
              </span>
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-48 overflow-visible"
            data-testid="analytics-cumulative-chart"
          >
            <defs>
              <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = chartH - 26 - ratio * (chartH - 52);
              return (
                <line
                  key={ratio}
                  x1="24"
                  y1={y}
                  x2={chartW - 24}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })}

            {areaPath && <path d={areaPath} fill="url(#cumFill)" />}
            {linePath && (
              <motion.path
                d={linePath}
                fill="none"
                stroke="#6366F1"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
            )}

            {/* Vertical Magnetic Scrubber Line */}
            {inspectedPoint && (
              <g>
                <line
                  x1={inspectedPoint.x}
                  y1={14}
                  x2={inspectedPoint.x}
                  y2={chartH - 26}
                  stroke="#6366F1"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={inspectedPoint.x}
                  cy={inspectedPoint.y}
                  r="6"
                  fill="#6366F1"
                  stroke="#0F1626"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Interactive Day Hover Columns */}
            {points.map((p) => (
              <g
                key={p.day}
                onMouseEnter={() => setHoveredDay(p.day)}
                onMouseLeave={() => setHoveredDay(null)}
                className="cursor-crosshair"
              >
                <rect
                  x={p.x - chartW / (points.length * 2)}
                  y={0}
                  width={chartW / points.length}
                  height={chartH}
                  fill="transparent"
                />
                {(p.dailyPaise > 0 || p.day === 1 || p.day === points.length) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredDay === p.day ? 5 : 3}
                    className="fill-indigo-500"
                  />
                )}
              </g>
            ))}
          </svg>
        </div>
      </SpotlightSurface>
    </div>
  );
};

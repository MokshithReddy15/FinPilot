import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  Budget,
  CATEGORY_COLORS,
  Transaction,
  TransactionType,
  computeBudgetStatuses,
  computeMonthlyComparison,
  computeSummaryMetrics,
  formatIndianCurrency,
  formatMonthLabel,
  previousMonthKey,
} from '../domain/finpilotStore';
import { CountUpText } from './CountUpText';
import { SpotlightSurface } from './SpotlightSurface';

interface DashboardTabProps {
  transactions: Transaction[];
  budgets: Budget[];
  activeMonth: string;
  currencySymbol: string;
  onSelectMonth: (month: string) => void;
  onNavigate: (tab: 'dashboard' | 'transactions' | 'analytics' | 'budget' | 'python') => void;
  onLoadDemo: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  transactions,
  budgets,
  activeMonth,
  currencySymbol,
  onSelectMonth,
  onNavigate,
  onLoadDemo,
}) => {
  const [kpiScope, setKpiScope] = useState<'ALL' | 'MONTH'>('ALL');
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [simulatedSavingsTarget, setSimulatedSavingsTarget] = useState<number>(45);
  const [recentStreamFilter, setRecentStreamFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const allMetrics = useMemo(
    () => computeSummaryMetrics(transactions, 'ALL'),
    [transactions]
  );
  const monthMetrics = useMemo(
    () => computeSummaryMetrics(transactions, activeMonth),
    [transactions, activeMonth]
  );
  const activeMetrics = kpiScope === 'ALL' ? allMetrics : monthMetrics;

  const comparison = useMemo(
    () => computeMonthlyComparison(transactions, activeMonth),
    [transactions, activeMonth]
  );
  const topBudgets = useMemo(
    () => computeBudgetStatuses(transactions, budgets, activeMonth).slice(0, 3),
    [transactions, budgets, activeMonth]
  );

  // Build 6-month series ending at activeMonth
  const sixMonths = useMemo(() => {
    const arr: Array<{
      month: string;
      label: string;
      incomePaise: number;
      expensePaise: number;
      netPaise: number;
      savingsRate: number;
    }> = [];
    let cursor = activeMonth;
    for (let i = 0; i < 6; i++) {
      const m = computeSummaryMetrics(transactions, cursor);
      arr.unshift({
        month: cursor,
        label: formatMonthLabel(cursor),
        incomePaise: m.incomePaise,
        expensePaise: m.expensePaise,
        netPaise: m.balancePaise,
        savingsRate: m.savingsRate,
      });
      cursor = previousMonthKey(cursor);
    }
    return arr;
  }, [transactions, activeMonth]);

  const inspectedMonthObj = useMemo(() => {
    const target = hoveredMonth || activeMonth;
    return (
      sixMonths.find((s) => s.month === target) ||
      sixMonths[sixMonths.length - 1]
    );
  }, [sixMonths, hoveredMonth, activeMonth]);

  const maxSixMonthVal = Math.max(
    1,
    ...sixMonths.flatMap((s) => [s.incomePaise, s.expensePaise])
  );

  // Smooth SVG spline points for Income and Expense curves over the 6 months
  const svgW = 640;
  const svgH = 190;
  const padX = 48;
  const padY = 24;

  const chartNodes = sixMonths.map((item, idx) => {
    const x =
      sixMonths.length > 1
        ? padX + (idx / (sixMonths.length - 1)) * (svgW - padX * 2)
        : svgW / 2;
    const incY =
      svgH - padY - (item.incomePaise / maxSixMonthVal) * (svgH - padY * 2);
    const expY =
      svgH - padY - (item.expensePaise / maxSixMonthVal) * (svgH - padY * 2);
    return { ...item, x, incY, expY };
  });

  const buildSmoothCurve = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = ((p0.x + p1.x) / 2).toFixed(1);
      d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const incCurvePath = buildSmoothCurve(
    chartNodes.map((n) => ({ x: n.x, y: n.incY }))
  );
  const expCurvePath = buildSmoothCurve(
    chartNodes.map((n) => ({ x: n.x, y: n.expY }))
  );
  const incAreaPath =
    chartNodes.length > 1
      ? `${incCurvePath} L ${chartNodes[chartNodes.length - 1].x.toFixed(1)} ${svgH - padY} L ${chartNodes[0].x.toFixed(1)} ${svgH - padY} Z`
      : '';
  const expAreaPath =
    chartNodes.length > 1
      ? `${expCurvePath} L ${chartNodes[chartNodes.length - 1].x.toFixed(1)} ${svgH - padY} L ${chartNodes[0].x.toFixed(1)} ${svgH - padY} Z`
      : '';

  const recentTransactions = useMemo(() => {
    return transactions
      .filter((tx) =>
        recentStreamFilter === 'ALL' ? true : tx.type === recentStreamFilter
      )
      .slice(0, 6);
  }, [transactions, recentStreamFilter]);

  // Projected annual savings calculation for the interactive What-If Runway Slider
  const projectedMonthlySavingsPaise = Math.round(
    (monthMetrics.incomePaise * simulatedSavingsTarget) / 100
  );
  const projectedAnnualSavingsPaise = projectedMonthlySavingsPaise * 12;

  if (transactions.length === 0) {
    return (
      <SpotlightSurface className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D1322] p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
          <Wallet className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Your FinPilot Spatial Ledger is Empty
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Populate 6 months of realistic Indian fintech demo transactions (salary, freelance retainers, rent, groceries, dining, utilities) or log your first entry.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onLoadDemo}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            Load 6-Month Demo Data
          </button>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add First Transaction
          </button>
        </div>
      </SpotlightSurface>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scope Switcher Toolbar + Quick Interactive Hints */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Telemetry Scope:
          </span>
          <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-[#111827] p-1 border border-slate-300/60 dark:border-slate-800">
            {(
              [
                ['ALL', 'All-Time Vault (6 Mo)'],
                ['MONTH', `Active Month (${formatMonthLabel(activeMonth)})`],
              ] as const
            ).map(([scopeKey, label]) => {
              const isSelected = kpiScope === scopeKey;
              return (
                <button
                  key={scopeKey}
                  type="button"
                  onClick={() => setKpiScope(scopeKey)}
                  className={`relative px-3.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="kpiScopePill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-indigo-600"
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Click any month node on the Cashflow Horizon to time-travel</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            + Quick Entry (Ctrl+N)
          </button>
        </div>
      </div>

      {/* Row 1: Tactile 3D-Tilt Hero Vault Card + 3 Kinetic KPI Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        {/* Primary Tactile Vault Card (5 cols) */}
        <SpotlightSurface
          enableTilt
          delay={0}
          className="lg:col-span-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-[#111827] to-indigo-950/90 text-white p-6 flex flex-col justify-between shadow-lg"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-300">
                {kpiScope === 'ALL'
                  ? 'Total Net Balance'
                  : `Net Surplus · ${formatMonthLabel(activeMonth)}`}
              </span>
              <span className="font-mono text-xs text-indigo-300/80 tabular-nums">
                {transactions.length} ledger records
              </span>
            </div>

            <div className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums">
              <CountUpText
                value={activeMetrics.balancePaise}
                formatter={(v) => formatIndianCurrency(Math.round(v), currencySymbol)}
              />
            </div>
          </div>

          {/* Interactive What-If Savings Runway Simulator */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-indigo-200 font-medium">
                <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
                Interactive Savings Simulator:
                <strong className="font-mono text-white tabular-nums">
                  {simulatedSavingsTarget}%
                </strong>
              </span>
              <span className="font-mono text-emerald-300 font-semibold tabular-nums">
                {formatIndianCurrency(projectedAnnualSavingsPaise, currencySymbol)}/yr
              </span>
            </div>
            <input
              type="range"
              aria-label="Simulated Savings Rate Percentage"
              min={10}
              max={75}
              step={1}
              value={simulatedSavingsTarget}
              onChange={(e) => setSimulatedSavingsTarget(Number(e.target.value))}
              className="w-full accent-indigo-400 h-1.5 bg-white/15 rounded-lg cursor-pointer"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-indigo-200/70">
              <span>
                Actual {formatMonthLabel(activeMonth)} rate:{' '}
                <strong className="font-mono text-white tabular-nums">
                  {monthMetrics.savingsRate.toFixed(1)}%
                </strong>
              </span>
              <span>
                Monthly target:{' '}
                <strong className="font-mono text-white tabular-nums">
                  {formatIndianCurrency(projectedMonthlySavingsPaise, currencySymbol)}
                </strong>
              </span>
            </div>
          </div>
        </SpotlightSurface>

        {/* 3 Secondary Kinetic Stat Cards (7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Income Card */}
          <SpotlightSurface
            enableTilt
            delay={0.05}
            className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Income
                </span>
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  +Inflow
                </span>
              </div>
              <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                <CountUpText
                  value={activeMetrics.incomePaise}
                  formatter={(v) => formatIndianCurrency(Math.round(v), currencySymbol)}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
              <div>{formatMonthLabel(activeMonth)} Inflow:</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                {formatIndianCurrency(comparison.currentIncomePaise, currencySymbol)}
              </div>
            </div>
          </SpotlightSurface>

          {/* Total Expenses Card */}
          <SpotlightSurface
            enableTilt
            delay={0.1}
            className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Expenses
                </span>
                {comparison.expenseChangePct !== null && (
                  <span
                    className={`inline-flex items-center font-mono text-xs font-semibold tabular-nums ${
                      comparison.expenseChangePct > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {comparison.expenseChangePct >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {Math.abs(comparison.expenseChangePct).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
                <CountUpText
                  value={activeMetrics.expensePaise}
                  formatter={(v) => formatIndianCurrency(Math.round(v), currencySymbol)}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
              <div>
                {formatMonthLabel(activeMonth)} vs {formatMonthLabel(comparison.previousMonth)}:
              </div>
              <div className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                {formatIndianCurrency(comparison.currentExpensePaise, currencySymbol)}
              </div>
            </div>
          </SpotlightSurface>

          {/* Savings Rate Radial Gauge Card */}
          <SpotlightSurface
            enableTilt
            delay={0.15}
            className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-5 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Savings Rate
                </span>
                <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
                  <CountUpText
                    value={activeMetrics.savingsRate}
                    formatter={(v) => `${v.toFixed(1)}%`}
                  />
                </div>
              </div>

              {/* Mini Radial Progress Ring */}
              <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0">
                <circle
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  className="text-slate-200 dark:text-slate-800"
                />
                <motion.circle
                  cx="23"
                  cy="23"
                  r="18"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  transform="rotate(-90 23 23)"
                  initial={{ strokeDasharray: '0 113.1' }}
                  animate={{
                    strokeDasharray: `${Math.max(
                      0,
                      Math.min(100, activeMetrics.savingsRate) * 1.131
                    ).toFixed(1)} 113.1`,
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </svg>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
              <div>Efficiency Ratio:</div>
              <div className="mt-0.5 text-slate-700 dark:text-slate-300 font-medium">
                {activeMetrics.savingsRate >= 35
                  ? 'High Wealth Velocity'
                  : activeMetrics.savingsRate >= 20
                  ? 'Balanced Cashflow'
                  : 'Tight Margin'}
              </div>
            </div>
          </SpotlightSurface>
        </div>
      </div>

      {/* Row 2: Interactive 6-Month Cashflow River Scrubber + Budget Health Gauges */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Interactive Dual-Stream Cashflow Horizon (7 cols) */}
        <SpotlightSurface
          delay={0.12}
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6 flex flex-col justify-between"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Interactive 6-Month Cashflow Horizon
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hover or click any month node to inspect cashflow velocity & switch active period
              </p>
            </div>

            {/* Live Inspected Month Telemetry Readout */}
            {inspectedMonthObj && (
              <div className="flex items-center gap-4 rounded-xl bg-slate-100/90 dark:bg-[#162036] px-3.5 py-2 border border-slate-200/80 dark:border-slate-700/70">
                <div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {inspectedMonthObj.label} Inflow
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatIndianCurrency(inspectedMonthObj.incomePaise, currencySymbol)}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
                <div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {inspectedMonthObj.label} Outflow
                  </div>
                  <div className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatIndianCurrency(inspectedMonthObj.expensePaise, currencySymbol)}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
                <div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Saved
                  </div>
                  <div className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {inspectedMonthObj.savingsRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive SVG Dual-Curve + Tactile Columns */}
          <div className="mt-5 relative" data-testid="dashboard-mini-chart">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-48 overflow-visible"
            >
              <defs>
                <linearGradient id="dashIncGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="dashExpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Subtle grid lines */}
              {[0.25, 0.5, 0.75, 1].map((r) => {
                const y = svgH - padY - r * (svgH - padY * 2);
                return (
                  <line
                    key={r}
                    x1={padX - 16}
                    y1={y}
                    x2={svgW - padX + 16}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-200/80 dark:text-slate-800/90"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Filled Spline Areas */}
              {incAreaPath && <path d={incAreaPath} fill="url(#dashIncGrad)" />}
              {expAreaPath && <path d={expAreaPath} fill="url(#dashExpGrad)" />}

              {/* Smooth Curves */}
              {incCurvePath && (
                <motion.path
                  d={incCurvePath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.8"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              )}
              {expCurvePath && (
                <motion.path
                  d={expCurvePath}
                  fill="none"
                  stroke="#F43F5E"
                  strokeWidth="2.8"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                />
              )}

              {/* Interactive Month Columns & Nodes */}
              {chartNodes.map((node) => {
                const isInspected =
                  (hoveredMonth || activeMonth) === node.month;
                const isSelectedMonth = activeMonth === node.month;

                return (
                  <g
                    key={node.month}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredMonth(node.month)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    onClick={() => onSelectMonth(node.month)}
                  >
                    {/* Invisible wide hover target column */}
                    <rect
                      x={node.x - 36}
                      y={0}
                      width={72}
                      height={svgH}
                      fill="transparent"
                    />

                    {/* Vertical highlight beam on active/hovered month */}
                    {isInspected && (
                      <line
                        x1={node.x}
                        y1={12}
                        x2={node.x}
                        y2={svgH - padY}
                        stroke="#6366F1"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Paired tactile bars */}
                    <rect
                      x={node.x - 10}
                      y={node.incY}
                      width={8}
                      height={Math.max(4, svgH - padY - node.incY)}
                      rx={3}
                      fill="#10B981"
                      opacity={isInspected ? 0.95 : 0.45}
                    />
                    <rect
                      x={node.x + 2}
                      y={node.expY}
                      width={8}
                      height={Math.max(4, svgH - padY - node.expY)}
                      rx={3}
                      fill="#F43F5E"
                      opacity={isInspected ? 0.95 : 0.45}
                    />

                    {/* Interactive glowing nodes */}
                    <circle
                      cx={node.x}
                      cy={node.incY}
                      r={isInspected ? 5.5 : 3.5}
                      fill="#10B981"
                      stroke="#0F1626"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={node.x}
                      cy={node.expY}
                      r={isInspected ? 5.5 : 3.5}
                      fill="#F43F5E"
                      stroke="#0F1626"
                      strokeWidth="1.5"
                    />

                    {/* Month label */}
                    <text
                      x={node.x}
                      y={svgH - 4}
                      textAnchor="middle"
                      className={`text-[11px] font-mono ${
                        isSelectedMonth
                          ? 'fill-indigo-500 font-bold'
                          : isInspected
                          ? 'fill-slate-900 dark:fill-white font-semibold'
                          : 'fill-slate-400 dark:fill-slate-500'
                      }`}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {formatMonthLabel(comparison.currentMonth)} Spend:{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                {formatIndianCurrency(comparison.currentExpensePaise, currencySymbol)}
              </strong>{' '}
              vs {formatMonthLabel(comparison.previousMonth)}:{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                {formatIndianCurrency(comparison.previousExpensePaise, currencySymbol)}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Explore Deep Analytics →
            </button>
          </div>
        </SpotlightSurface>

        {/* Budget Health Strip with Radial & Liquid Gauges (5 cols) */}
        <SpotlightSurface
          delay={0.18}
          className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Budget Pressure Radar
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('budget')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Tune Caps →
              </button>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Top 3 categories closest to monthly cap in {formatMonthLabel(activeMonth)}
            </p>

            {topBudgets.length === 0 ? (
              <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No category budgets configured yet.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {topBudgets.map((b, i) => {
                  const barColor =
                    b.level === 'danger'
                      ? 'from-rose-600 to-rose-400'
                      : b.level === 'warning'
                      ? 'from-amber-500 to-amber-400'
                      : 'from-emerald-600 to-emerald-400';
                  const statusLabel =
                    b.level === 'danger'
                      ? 'Over Limit'
                      : b.level === 'warning'
                      ? 'Approaching Limit'
                      : 'On Track';
                  const statusTextColor =
                    b.level === 'danger'
                      ? 'text-rose-600 dark:text-rose-400'
                      : b.level === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400';

                  return (
                    <div
                      key={b.category}
                      onClick={() => onNavigate('budget')}
                      className="group rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#141D31] p-3.5 hover:border-indigo-500/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-400 transition-colors">
                          {b.category}
                        </span>
                        <span className={`font-mono text-xs font-bold tabular-nums ${statusTextColor}`}>
                          {Math.round(b.percentUsed)}% · {statusLabel}
                        </span>
                      </div>

                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, Math.max(0, b.percentUsed))}%`,
                          }}
                          transition={{
                            duration: 0.55,
                            delay: i * 0.08,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className={`h-full bg-gradient-to-r ${barColor}`}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>
                          Spent: {formatIndianCurrency(b.spentPaise, currencySymbol)}
                        </span>
                        <span>
                          Cap: {formatIndianCurrency(b.limitPaise, currencySymbol)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Thresholds: &lt;70% Green · 70–99% Amber · 100%+ Red</span>
            <Compass className="h-4 w-4 text-indigo-400" />
          </div>
        </SpotlightSurface>
      </div>

      {/* Row 3: Interactive Recent Activity Stream with Animated Filter Tabs */}
      <SpotlightSurface
        delay={0.22}
        className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Recent Ledger Stream
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest 6 transactions with instant stream filtering
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stream Filter Segmented Control */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#162036] p-1 border border-slate-200/80 dark:border-slate-800">
              {(['ALL', 'EXPENSE', 'INCOME'] as const).map((fKey) => {
                const active = recentStreamFilter === fKey;
                return (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() => setRecentStreamFilter(fKey)}
                    className={`relative px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="recentStreamFilterPill"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute inset-0 rounded-lg bg-indigo-600"
                      />
                    )}
                    <span className="relative z-10">
                      {fKey === 'ALL'
                        ? 'All Entries'
                        : fKey === 'EXPENSE'
                        ? 'Expenses'
                        : 'Income'}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              Open Full Ledger ({transactions.length}) →
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          <AnimatePresence mode="popLayout">
            {recentTransactions.map((tx, idx) => {
              const isIncome = tx.type === TransactionType.INCOME;
              const signedPaise = isIncome ? tx.amountPaise : -tx.amountPaise;
              const catColor = CATEGORY_COLORS[tx.category] || '#6366F1';

              return (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  onClick={() => onNavigate('transactions')}
                  className="flex items-center justify-between py-3 px-3 text-sm hover:bg-slate-50/80 dark:hover:bg-[#162036] rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="h-3 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: catColor }}
                    />
                    <span className="font-semibold text-slate-900 dark:text-slate-100 w-28 shrink-0">
                      {tx.category}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span className="truncate text-slate-500 dark:text-slate-400">
                      {tx.note || 'No description'}
                    </span>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      {tx.date}
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums w-32 text-right ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatIndianCurrency(signedPaise, currencySymbol, {
                        signed: true,
                      })}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </SpotlightSurface>
    </div>
  );
};

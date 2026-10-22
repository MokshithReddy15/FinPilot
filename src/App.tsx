/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Code2,
  CreditCard,
  Download,
  LayoutDashboard,
  Moon,
  RotateCcw,
  Sun,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Budget,
  EXPENSE_CATEGORIES,
  Transaction,
  TransactionType,
  checkBudgetThresholdCrossing,
  formatIndianCurrency,
  formatMonthLabel,
  generateDemoData,
  getTodayIso,
} from './domain/finpilotStore';
import { DashboardTab } from './components/DashboardTab';
import { TransactionsTab } from './components/TransactionsTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { BudgetTab } from './components/BudgetTab';
import { PythonWorkbenchTab } from './components/PythonWorkbenchTab';

type NavTab = 'dashboard' | 'transactions' | 'analytics' | 'budget' | 'python';

interface ToastState {
  id: number;
  message: string;
  level: 'info' | 'success' | 'warning' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
}

const STORAGE_KEY = 'finpilot_data_v1';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [currencySymbol, setCurrencySymbol] = useState<string>('Rs. ');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.transactions)) {
          return parsed.transactions;
        }
      }
    } catch {
      // Fallback to demo data
    }
    return generateDemoData().transactions;
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.budgets)) {
          return parsed.budgets;
        }
      }
    } catch {
      // Fallback to demo data
    }
    return generateDemoData().budgets;
  });

  const [toast, setToast] = useState<ToastState | null>(null);
  const [focusAmountTrigger, setFocusAmountTrigger] = useState<number>(0);
  const toastTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync dark/light class on <html>
  useEffect(() => {
    const rootEl = document.documentElement;
    if (theme === 'dark') {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
  }, [theme]);

  // Persist to localStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          currencySymbol,
          customCategories,
          transactions,
          budgets,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [transactions, budgets, currencySymbol, customCategories]);

  const showToast = useCallback(
    (
      message: string,
      level: ToastState['level'] = 'info',
      durationMs = 5000,
      actionLabel?: string,
      onAction?: () => void
    ) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({
        id: Date.now(),
        message,
        level,
        actionLabel,
        onAction,
      });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, durationMs);
    },
    []
  );

  // Global Ctrl+N shortcut to switch to Transactions and focus Amount field
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setActiveTab('transactions');
        setFocusAmountTrigger((n) => n + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([getTodayIso().slice(0, 7)]);
    for (const tx of transactions) {
      if (tx.date && tx.date.length >= 7) {
        set.add(tx.date.slice(0, 7));
      }
    }
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => availableMonths[0] || getTodayIso().slice(0, 7)
  );

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth) && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const handleAddTransaction = useCallback(
    (newTxData: Omit<Transaction, 'id'>) => {
      const newTx: Transaction = {
        ...newTxData,
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };

      const alert = checkBudgetThresholdCrossing(
        transactions,
        budgets,
        newTx,
        currencySymbol
      );

      setTransactions((prev) => {
        const next = [newTx, ...prev];
        next.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        return next;
      });

      if (alert) {
        showToast(alert.message, alert.level, 6000);
      } else {
        showToast(
          `Added ${newTx.category} (${formatIndianCurrency(newTx.amountPaise, currencySymbol)})`,
          'success',
          3500
        );
      }
    },
    [transactions, budgets, currencySymbol, showToast]
  );

  const handleDeleteTransaction = useCallback(
    (txId: string) => {
      const target = transactions.find((t) => t.id === txId);
      if (!target) return;

      setTransactions((prev) => prev.filter((t) => t.id !== txId));

      showToast(
        `Deleted ${target.category} (${formatIndianCurrency(target.amountPaise, currencySymbol)})`,
        'warning',
        5000,
        'Undo',
        () => {
          setTransactions((prev) => {
            if (prev.some((p) => p.id === target.id)) return prev;
            const next = [target, ...prev];
            next.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
            return next;
          });
          showToast(`Restored ${target.category} transaction.`, 'success', 3000);
        }
      );
    },
    [transactions, currencySymbol, showToast]
  );

  const handleSaveBudget = useCallback(
    (category: string, monthlyLimitPaise: number) => {
      if (
        !EXPENSE_CATEGORIES.includes(category) &&
        !customCategories.includes(category)
      ) {
        setCustomCategories((prev) => [...prev, category]);
      }

      setBudgets((prev) => {
        const existingIdx = prev.findIndex((b) => b.category === category);
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = { category, monthlyLimitPaise };
          return copy;
        }
        return [...prev, { category, monthlyLimitPaise }];
      });

      showToast(
        `Budget saved for ${category}: ${formatIndianCurrency(monthlyLimitPaise, currencySymbol)}/mo`,
        'success',
        3500
      );
    },
    [customCategories, currencySymbol, showToast]
  );

  const handleDeleteBudget = useCallback(
    (category: string) => {
      setBudgets((prev) => prev.filter((b) => b.category !== category));
      showToast(
        `Removed monthly limit for ${category} (existing transactions kept intact).`,
        'info',
        3500
      );
    },
    [showToast]
  );

  const handleLoadDemoData = useCallback(() => {
    const demo = generateDemoData();
    setTransactions(demo.transactions);
    setBudgets(demo.budgets);
    showToast(
      `Loaded ${demo.transactions.length} realistic demo transactions across 6 months.`,
      'success',
      4000
    );
  }, [showToast]);

  const handleClearAllData = useCallback(() => {
    setTransactions([]);
    setBudgets([]);
    showToast('Cleared all transactions and budgets.', 'warning', 4000);
  }, [showToast]);

  const handleRunStressTest = useCallback(() => {
    const base = generateDemoData();
    const extra: Transaction[] = [];
    const cats = [...EXPENSE_CATEGORIES];
    const months = availableMonths.length >= 6 ? availableMonths.slice(0, 6) : ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05'];

    for (let i = 0; i < 5000; i++) {
      const m = months[i % months.length];
      const day = String((i % 28) + 1).padStart(2, '0');
      const cat = cats[i % cats.length];
      extra.push({
        id: `stress-${i}`,
        type: i % 8 === 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
        amountPaise: ((i % 45) + 5) * 10000,
        category: i % 8 === 0 ? 'Freelance' : cat,
        date: `${m}-${day}`,
        note: `Batch Benchmark Entry #${i + 1}`,
      });
    }

    const combined = [...base.transactions, ...extra];
    combined.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    setTransactions(combined);
    setBudgets(base.budgets);
    showToast(
      `Loaded ${combined.length.toLocaleString()} transactions for instant filter/sort benchmarking.`,
      'info',
      4500
    );
  }, [availableMonths, showToast]);

  const handleDownloadJson = () => {
    const payload = {
      version: 1,
      currency_symbol: currencySymbol,
      custom_categories: customCategories,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount_paise: t.amountPaise,
        category: t.category,
        note: t.note,
        date: t.date,
      })),
      budgets: budgets.map((b) => ({
        category: b.category,
        monthly_limit_paise: b.monthlyLimitPaise,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finpilot_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Saved finpilot_data.json to disk.', 'success', 3500);
  };

  const handleUploadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const rawTxs = Array.isArray(raw.transactions) ? raw.transactions : [];
        const rawBudgets = Array.isArray(raw.budgets) ? raw.budgets : [];
        const loadedTxs: Transaction[] = rawTxs.map((item: Record<string, unknown>, idx: number) => ({
          id: String(item.id || `loaded-${idx}`),
          type:
            String(item.type).toUpperCase() === 'INCOME'
              ? TransactionType.INCOME
              : TransactionType.EXPENSE,
          amountPaise: Number(item.amount_paise ?? item.amountPaise ?? 100),
          category: String(item.category || 'Other'),
          note: String(item.note || ''),
          date: String(item.date || getTodayIso()),
        }));
        const loadedBudgets: Budget[] = rawBudgets.map((b: Record<string, unknown>) => ({
          category: String(b.category || 'Other'),
          monthlyLimitPaise: Number(b.monthly_limit_paise ?? b.monthlyLimitPaise ?? 0),
        }));
        setTransactions(loadedTxs);
        setBudgets(loadedBudgets);
        showToast(
          `Loaded ${loadedTxs.length} transactions from ${file.name}.`,
          'success',
          4000
        );
      } catch {
        showToast('Invalid finpilot_data.json file format.', 'danger', 4500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navItems: Array<{
    key: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'transactions', label: 'Transactions', icon: CreditCard },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'budget', label: 'Budget Planner', icon: Target },
    { key: 'python', label: 'Python Tkinter Code', icon: Code2 },
  ];

  const pageTitles: Record<NavTab, string> = {
    dashboard: 'Dashboard Overview',
    transactions: 'Transactions Ledger',
    analytics: 'Spending Analytics & Insights',
    budget: 'Monthly Budget Planner',
    python: 'Python 3.11 + Tkinter + Matplotlib Source & Audit',
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#07090E] text-slate-900 dark:text-[#F8FAFC] transition-colors">
      {/* Left Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0C111D]">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-display font-bold text-sm shadow-sm">
              FP
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              FinPilot
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Spatial Personal Finance Suite
          </p>
        </div>

        <nav
          aria-label="Sidebar Navigation"
          className="flex-1 px-3 py-4 space-y-1.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'text-indigo-600 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#141D31] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebarActivePill"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-xl bg-indigo-600/15 dark:bg-indigo-600/25 border border-indigo-500/30"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Data Controls (Seed / JSON Persistence) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 px-1">
            Data & Offline JSON
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Save JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              Load JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleUploadJson}
              className="hidden"
            />
          </div>

          <button
            type="button"
            onClick={handleLoadDemoData}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 dark:bg-[#162036] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Load Demo Data
          </button>

          <button
            type="button"
            onClick={handleClearAllData}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All Data
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#07090E]/90 backdrop-blur-md px-6 py-3.5">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              {pageTitles[activeTab]}
            </h1>
          </div>

          {/* Mobile Tab Bar */}
          <div className="flex md:hidden items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeTab === item.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Active Month Selector */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="topbar-month-select"
                className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Month:
              </label>
              <select
                id="topbar-month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none tabular-nums"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)} ({m})
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Symbol Selector */}
            <select
              aria-label="Currency Symbol"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="Rs. ">Rs. (INR)</option>
              <option value="INR ">INR</option>
              <option value="$">$ (USD)</option>
              <option value="€">€ (EUR)</option>
            </select>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-600" />
                  Dark
                </>
              )}
            </button>
          </div>
        </header>

        {/* Active View Container with Smooth Spring Entrance */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'dashboard' && (
                <DashboardTab
                  transactions={transactions}
                  budgets={budgets}
                  activeMonth={selectedMonth}
                  currencySymbol={currencySymbol}
                  onSelectMonth={setSelectedMonth}
                  onNavigate={setActiveTab}
                  onLoadDemo={handleLoadDemoData}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsTab
                  transactions={transactions}
                  customCategories={customCategories}
                  availableMonths={availableMonths}
                  currencySymbol={currencySymbol}
                  focusAmountTrigger={focusAmountTrigger}
                  onAddTransaction={handleAddTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onRunStressTest={handleRunStressTest}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsTab
                  transactions={transactions}
                  budgets={budgets}
                  selectedMonth={selectedMonth}
                  availableMonths={availableMonths}
                  currencySymbol={currencySymbol}
                  onSelectMonth={setSelectedMonth}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetTab
                  transactions={transactions}
                  budgets={budgets}
                  customCategories={customCategories}
                  activeMonth={selectedMonth}
                  currencySymbol={currencySymbol}
                  onSaveBudget={handleSaveBudget}
                  onDeleteBudget={handleDeleteBudget}
                />
              )}

              {activeTab === 'python' && <PythonWorkbenchTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Toast Notification (Undo on Delete / Budget 80% & 100% Warnings) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="toast-banner"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all ${
            toast.level === 'danger'
              ? 'border-rose-500/60 bg-[#1E293B] text-white'
              : toast.level === 'warning'
              ? 'border-amber-500/60 bg-[#1E293B] text-white'
              : toast.level === 'success'
              ? 'border-emerald-500/60 bg-[#1E293B] text-white'
              : 'border-indigo-500/60 bg-[#1E293B] text-white'
          }`}
        >
          <span className="text-xs font-medium">{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                const fn = toast.onAction;
                setToast(null);
                fn?.();
              }}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer whitespace-nowrap"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownUp,
  Download,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Transaction,
  TransactionType,
  formatIndianCurrency,
  getTodayIso,
  rupeesToPaise,
  validateIsoDate,
} from '../domain/finpilotStore';
import { SpotlightSurface } from './SpotlightSurface';

interface TransactionsTabProps {
  transactions: Transaction[];
  customCategories: string[];
  availableMonths: string[];
  currencySymbol: string;
  focusAmountTrigger: number;
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  onDeleteTransaction: (txId: string) => void;
  onRunStressTest: () => void;
}

type SortField = 'date' | 'type' | 'category' | 'amount';

const QUICK_PRESETS: ReadonlyArray<{
  label: string;
  type: TransactionType;
  amountRupees: number;
  category: string;
  note: string;
}> = [
  {
    label: 'Specialty Coffee · 320',
    type: TransactionType.EXPENSE,
    amountRupees: 320,
    category: 'Food',
    note: 'Third Wave Specialty Coffee',
  },
  {
    label: 'Fresh Groceries · 1,850',
    type: TransactionType.EXPENSE,
    amountRupees: 1850,
    category: 'Groceries',
    note: 'Organic Produce & Dairy Refill',
  },
  {
    label: 'Fuel Refill · 2,400',
    type: TransactionType.EXPENSE,
    amountRupees: 2400,
    category: 'Fuel',
    note: 'XP95 Highway Fuel Refill',
  },
  {
    label: 'Freelance Milestone · +25,000',
    type: TransactionType.INCOME,
    amountRupees: 25000,
    category: 'Freelance',
    note: 'Product Design & Python Advisory Milestone',
  },
];

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  customCategories,
  availableMonths,
  currencySymbol,
  focusAmountTrigger,
  onAddTransaction,
  onDeleteTransaction,
  onRunStressTest,
}) => {
  // Add Form State
  const [formType, setFormType] = useState<TransactionType>(
    TransactionType.EXPENSE
  );
  const [amountInput, setAmountInput] = useState<string>('');
  const [categoryInput, setCategoryInput] = useState<string>(
    EXPENSE_CATEGORIES[0]
  );
  const [dateInput, setDateInput] = useState<string>(getTodayIso());
  const [noteInput, setNoteInput] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Filter & Sort State
  const [rawSearch, setRawSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState<number>(150);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Section 5 Rule 5: 150ms debounced search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(rawSearch);
      setVisibleLimit(150);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [rawSearch]);

  // Ctrl+N focus handler
  useEffect(() => {
    if (focusAmountTrigger > 0) {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }
  }, [focusAmountTrigger]);

  // Update category list when formType changes
  const activeTypeCategories = useMemo(() => {
    const base =
      formType === TransactionType.INCOME
        ? [...INCOME_CATEGORIES]
        : [...EXPENSE_CATEGORIES];
    for (const c of customCategories) {
      if (!base.includes(c)) {
        base.splice(base.length - 1, 0, c);
      }
    }
    return base;
  }, [formType, customCategories]);

  useEffect(() => {
    if (!activeTypeCategories.includes(categoryInput)) {
      setCategoryInput(activeTypeCategories[0] || 'Other');
    }
  }, [activeTypeCategories, categoryInput]);

  const allFilterCategories = useMemo(() => {
    const set = new Set<string>([
      ...INCOME_CATEGORIES,
      ...EXPENSE_CATEGORIES,
      ...customCategories,
    ]);
    return ['ALL', ...Array.from(set).sort()];
  }, [customCategories]);

  const filteredTransactions = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = transactions.filter((tx) => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterCategory !== 'ALL' && tx.category !== filterCategory)
        return false;
      if (filterMonth !== 'ALL' && !tx.date.startsWith(filterMonth))
        return false;
      if (q) {
        const hay =
          `${tx.category} ${tx.note} ${tx.date} ${(tx.amountPaise / 100).toFixed(2)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') {
        cmp = a.amountPaise - b.amountPaise;
      } else if (sortField === 'category') {
        cmp = a.category.localeCompare(b.category);
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else {
        cmp = a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [
    transactions,
    debouncedSearch,
    filterType,
    filterCategory,
    filterMonth,
    sortField,
    sortDesc,
  ]);

  // Global Delete key listener when a row is selected and focus is not inside an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' && selectedRowId) {
        e.preventDefault();
        if (confirmDeleteId === selectedRowId) {
          onDeleteTransaction(selectedRowId);
          setConfirmDeleteId(null);
          setSelectedRowId(null);
        } else {
          setConfirmDeleteId(selectedRowId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRowId, confirmDeleteId, onDeleteTransaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const paise = rupeesToPaise(amountInput);
      const validDate = validateIsoDate(dateInput);
      const cleanCat = categoryInput.trim();
      if (!cleanCat) {
        throw new Error('Category is required.');
      }
      onAddTransaction({
        type: formType,
        amountPaise: paise,
        category: cleanCat,
        date: validDate,
        note: noteInput.trim(),
      });
      setAmountInput('');
      setNoteInput('');
      setFormError(null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Invalid transaction input.'
      );
    }
  };

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDesc((prev) => !prev);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Date', 'Type', 'Category', 'Amount_INR', 'Note'];
    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.date,
      tx.type,
      `"${tx.category.replace(/"/g, '""')}"`,
      (tx.amountPaise / 100).toFixed(2),
      `"${(tx.note || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finpilot_transactions_${getTodayIso()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const displayedRows = filteredTransactions.slice(0, visibleLimit);

  return (
    <div className="space-y-6">
      {/* Add Transaction Form Card */}
      <SpotlightSurface className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6">
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Add Transaction
              </h2>
              <div
                role="group"
                aria-label="Transaction Type"
                className="inline-flex rounded-xl bg-slate-100 dark:bg-[#162036] p-1 border border-slate-200/80 dark:border-slate-800"
              >
                <button
                  type="button"
                  onClick={() => setFormType(TransactionType.EXPENSE)}
                  className={`relative px-3.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    formType === TransactionType.EXPENSE
                      ? 'text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {formType === TransactionType.EXPENSE && (
                    <motion.span
                      layoutId="txTypeTogglePill"
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-rose-600"
                    />
                  )}
                  <span className="relative z-10">− Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType(TransactionType.INCOME)}
                  className={`relative px-3.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    formType === TransactionType.INCOME
                      ? 'text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {formType === TransactionType.INCOME && (
                    <motion.span
                      layoutId="txTypeTogglePill"
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-emerald-600"
                    />
                  )}
                  <span className="relative z-10">+ Income</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Shortcuts: <kbd className="font-mono">Enter</kbd> submit ·{' '}
              <kbd className="font-mono">Delete</kbd> remove row ·{' '}
              <kbd className="font-mono">Ctrl+N</kbd> focus amount
            </div>
          </div>

          {/* 1-Tap Quick-Log Templates */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Instant Log:
            </span>
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onAddTransaction({
                    type: preset.type,
                    amountPaise: preset.amountRupees * 100,
                    category: preset.category,
                    date: getTodayIso(),
                    note: preset.note,
                  })
                }
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162036] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-500/60 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 items-end">
            <div className="lg:col-span-2">
              <label
                htmlFor="tx-amount-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Amount ({currencySymbol.trim()}) *
              </label>
              <input
                id="tx-amount-input"
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 2450.50"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none tabular-nums"
              />
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="tx-category-select"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Category *
              </label>
              <select
                id="tx-category-select"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {activeTypeCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="tx-date-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Date (YYYY-MM-DD) *
              </label>
              <input
                id="tx-date-input"
                type="text"
                placeholder="YYYY-MM-DD"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none tabular-nums"
              />
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="tx-note-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Note / Merchant
              </label>
              <input
                id="tx-note-input"
                type="text"
                placeholder="e.g. Zomato dinner or UPI transfer"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </button>
            </div>
          </div>

          {/* Inline Validation Error Banner */}
          {formError && (
            <div
              role="alert"
              data-testid="tx-form-error"
              className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400"
            >
              {formError}
            </div>
          )}
        </form>
      </SpotlightSurface>

      {/* Filter Bar + History Table Card */}
      <SpotlightSurface className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input (150ms debounced) */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                aria-label="Search transactions"
                placeholder="Search category, note, date..."
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className="w-56 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Filter by Type */}
            <select
              aria-label="Filter by Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="INCOME">Income Only</option>
              <option value="EXPENSE">Expense Only</option>
            </select>

            {/* Filter by Category */}
            <select
              aria-label="Filter by Category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              {allFilterCategories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>

            {/* Filter by Month */}
            <select
              aria-label="Filter by Month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-1.5 text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none tabular-nums"
            >
              <option value="ALL">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRunStressTest}
              title="Populate 5,000+ transactions to verify Section 5 Rule 4 instant filtering performance"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              5,000-Row Benchmark
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary count */}
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing{' '}
            <strong className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
              {displayedRows.length}
            </strong>{' '}
            of{' '}
            <strong className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
              {filteredTransactions.length}
            </strong>{' '}
            matching transactions
          </span>
          {selectedRowId && (
            <span className="text-indigo-500">
              Row selected · Press <kbd className="font-mono">Delete</kbd> to remove
            </span>
          )}
        </div>

        {/* High-Density Sortable Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162036] text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSortClick('date')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Date
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSortClick('type')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Type
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSortClick('category')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Category
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">Note</th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSortClick('amount')}
                    className="inline-flex items-center justify-end gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer ml-auto"
                  >
                    Amount
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
              {displayedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No transactions match the current search or filter criteria.
                  </td>
                </tr>
              ) : (
                displayedRows.map((tx, idx) => {
                  const isIncome = tx.type === TransactionType.INCOME;
                  const signedPaise = isIncome
                    ? tx.amountPaise
                    : -tx.amountPaise;
                  const isSelected = selectedRowId === tx.id;
                  const isConfirming = confirmDeleteId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => {
                        setSelectedRowId(tx.id);
                        if (confirmDeleteId && confirmDeleteId !== tx.id) {
                          setConfirmDeleteId(null);
                        }
                      }}
                      className={`h-9 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500/15'
                          : idx % 2 === 0
                          ? 'bg-white dark:bg-[#0F1626]'
                          : 'bg-slate-50/50 dark:bg-[#131C30]'
                      } hover:bg-indigo-500/10`}
                    >
                      <td className="py-2 px-3 font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-2 px-3 text-xs font-medium whitespace-nowrap">
                        <span
                          className={
                            isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {tx.note || '—'}
                      </td>
                      <td
                        className={`py-2 px-3 font-mono text-right font-semibold tabular-nums whitespace-nowrap ${
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatIndianCurrency(signedPaise, currencySymbol, {
                          showDecimals: true,
                          signed: true,
                        })}
                      </td>
                      <td
                        className="py-2 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteTransaction(tx.id);
                                setConfirmDeleteId(null);
                                if (selectedRowId === tx.id)
                                  setSelectedRowId(null);
                              }}
                              className="rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-rose-500 cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Delete ${tx.category} transaction on ${tx.date}`}
                            onClick={() => setConfirmDeleteId(tx.id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length > visibleLimit && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + 250)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Show 250 More Rows ({filteredTransactions.length - visibleLimit}{' '}
              remaining)
            </button>
          </div>
        )}
      </SpotlightSurface>
    </div>
  );
};

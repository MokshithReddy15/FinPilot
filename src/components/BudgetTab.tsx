import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Edit3, Minus, Plus, Trash2 } from 'lucide-react';
import {
  Budget,
  EXPENSE_CATEGORIES,
  Transaction,
  computeBudgetStatuses,
  formatIndianCurrency,
  formatMonthLabel,
  rupeesToPaise,
} from '../domain/finpilotStore';
import { SpotlightSurface } from './SpotlightSurface';

interface BudgetTabProps {
  transactions: Transaction[];
  budgets: Budget[];
  customCategories: string[];
  activeMonth: string;
  currencySymbol: string;
  onSaveBudget: (category: string, monthlyLimitPaise: number) => void;
  onDeleteBudget: (category: string) => void;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({
  transactions,
  budgets,
  customCategories,
  activeMonth,
  currencySymbol,
  onSaveBudget,
  onDeleteBudget,
}) => {
  const allExpenseCats = Array.from(
    new Set([...EXPENSE_CATEGORIES, ...customCategories])
  );

  const [selectedCategory, setSelectedCategory] = useState<string>(
    allExpenseCats[0] || 'Food'
  );
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [limitInput, setLimitInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const limitInputRef = useRef<HTMLInputElement>(null);

  const statuses = computeBudgetStatuses(transactions, budgets, activeMonth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetCategory =
      customCategoryInput.trim() || selectedCategory.trim();
    if (!targetCategory) {
      setErrorMsg('Please select or enter a category name.');
      return;
    }

    const raw = limitInput.trim().replace(/,/g, '');
    let paise = 0;
    if (raw === '0') {
      paise = 0;
    } else {
      try {
        paise = rupeesToPaise(raw);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Enter a valid monthly limit.'
        );
        return;
      }
    }

    onSaveBudget(targetCategory, paise);
    setCustomCategoryInput('');
    setLimitInput('');
  };

  const handleEditClick = (category: string, currentLimitPaise: number) => {
    if (allExpenseCats.includes(category)) {
      setSelectedCategory(category);
      setCustomCategoryInput('');
    } else {
      setCustomCategoryInput(category);
    }
    setLimitInput(String(Math.round(currentLimitPaise / 100)));
    setErrorMsg(null);
    limitInputRef.current?.focus();
    limitInputRef.current?.select();
  };

  const handleQuickStep = (
    category: string,
    currentLimitPaise: number,
    deltaPaise: number
  ) => {
    const nextPaise = Math.max(500 * 100, currentLimitPaise + deltaPaise);
    onSaveBudget(category, nextPaise);
  };

  return (
    <div className="space-y-6">
      {/* Top Form: Set or Update Monthly Budget */}
      <SpotlightSurface className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-6">
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Set Monthly Category Budget
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure monthly limits for {formatMonthLabel(activeMonth)} or use the ±1,000 tactile steppers on any card below
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 items-end">
            <div className="lg:col-span-4">
              <label
                htmlFor="budget-category-select"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Category
              </label>
              <select
                id="budget-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {allExpenseCats.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="budget-custom-category"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Or Custom Category (optional)
              </label>
              <input
                id="budget-custom-category"
                type="text"
                placeholder="e.g. Pet Care or Education"
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="budget-limit-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Monthly Limit ({currencySymbol.trim()}) *
              </label>
              <input
                id="budget-limit-input"
                ref={limitInputRef}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12000"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none tabular-nums"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Save Budget
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400"
            >
              {errorMsg}
            </div>
          )}
        </form>
      </SpotlightSurface>

      {/* Tactile Budget Cards Grid */}
      {statuses.length === 0 ? (
        <SpotlightSurface className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1626] p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No monthly budgets set. Use the form above to configure spending caps per category.
          </p>
        </SpotlightSurface>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statuses.map((st, idx) => {
            const barGrad =
              st.level === 'danger'
                ? 'from-rose-600 to-rose-400'
                : st.level === 'warning'
                ? 'from-amber-500 to-amber-400'
                : 'from-emerald-600 to-emerald-400';
            const statusLabel =
              st.level === 'danger'
                ? 'Over Limit'
                : st.level === 'warning'
                ? 'Approaching Limit'
                : 'On Track';
            const statusTextColor =
              st.level === 'danger'
                ? 'text-rose-600 dark:text-rose-400'
                : st.level === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400';

            return (
              <SpotlightSurface
                key={st.category}
                enableTilt
                delay={idx * 0.03}
                className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1626] p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {st.category}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${st.category} budget`}
                        onClick={() => handleEditClick(st.category, st.limitPaise)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${st.category} budget`}
                        onClick={() => onDeleteBudget(st.category)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      Spent{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {formatIndianCurrency(st.spentPaise, currencySymbol)}
                      </strong>{' '}
                      / {formatIndianCurrency(st.limitPaise, currencySymbol)}
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums ${statusTextColor}`}
                    >
                      {st.percentUsed.toFixed(0)}% · {statusLabel}
                    </span>
                  </div>

                  <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, Math.max(0, st.percentUsed))}%`,
                      }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full bg-gradient-to-r ${barGrad}`}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  {st.remainingPaise >= 0 ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      Remaining:{' '}
                      <strong className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                        {formatIndianCurrency(st.remainingPaise, currencySymbol)}
                      </strong>
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      Exceeded by{' '}
                      <strong className="font-mono tabular-nums">
                        {formatIndianCurrency(
                          Math.abs(st.remainingPaise),
                          currencySymbol
                        )}
                      </strong>
                    </span>
                  )}

                  {/* Tactile ±1,000 Stepper Controls */}
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      title="Decrease monthly cap by 1,000"
                      onClick={() =>
                        handleQuickStep(st.category, st.limitPaise, -1000 * 100)
                      }
                      className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 hover:border-indigo-500 transition-colors cursor-pointer"
                    >
                      <Minus className="h-2.5 w-2.5" />
                      1k
                    </button>
                    <button
                      type="button"
                      title="Increase monthly cap by 1,000"
                      onClick={() =>
                        handleQuickStep(st.category, st.limitPaise, 1000 * 100)
                      }
                      className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#162036] px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 hover:border-indigo-500 transition-colors cursor-pointer"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      1k
                    </button>
                  </div>
                </div>
              </SpotlightSurface>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * src/domain/finpilotStore.ts
 * Pure TypeScript mirror of finpilot/models.py, finpilot/store.py, and finpilot/seed.py.
 * Uses integer paise (₹1 = 100 paise) to prevent floating-point rounding bugs.
 */

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export const INCOME_CATEGORIES: readonly string[] = [
  'Salary',
  'Freelance',
  'Investments',
  'Dividends',
  'Refunds',
  'Gifts',
  'Other',
];

export const EXPENSE_CATEGORIES: readonly string[] = [
  'Food',
  'Rent',
  'Travel',
  'Shopping',
  'Bills',
  'Subscriptions',
  'Entertainment',
  'Health',
  'Fuel',
  'Groceries',
  'Other',
];

export const CATEGORY_COLORS: Record<string, string> = {
  Food: '#6366F1',
  Rent: '#10B981',
  Shopping: '#F59E0B',
  Travel: '#EC4899',
  Groceries: '#06B6D4',
  Bills: '#8B5CF6',
  Fuel: '#F97316',
  Entertainment: '#14B8A6',
  Subscriptions: '#3B82F6',
  Health: '#EF4444',
  Salary: '#10B981',
  Freelance: '#34D399',
  Investments: '#6366F1',
  Dividends: '#8B5CF6',
  Refunds: '#06B6D4',
  Gifts: '#F59E0B',
  Other: '#94A3B8',
};

export interface Transaction {
  id: string;
  type: TransactionType;
  amountPaise: number; // integer paise (1 INR = 100 paise)
  category: string;
  note: string;
  date: string; // YYYY-MM-DD
}

export interface Budget {
  category: string;
  monthlyLimitPaise: number;
}

export interface BudgetStatus {
  category: string;
  limitPaise: number;
  spentPaise: number;
  remainingPaise: number;
  percentUsed: number;
  level: 'ok' | 'warning' | 'danger';
}

export interface MonthlyComparison {
  currentMonth: string;
  previousMonth: string;
  currentIncomePaise: number;
  previousIncomePaise: number;
  currentExpensePaise: number;
  previousExpensePaise: number;
  expenseChangePct: number | null;
}

export interface BudgetAlert {
  level: 'warning' | 'danger';
  category: string;
  percent: number;
  message: string;
}

/**
 * Convert user-entered rupee string/number to exact integer paise.
 * Validates: required, numeric, > 0, <= 99,99,99,999.99, max 2 decimal places.
 */
export function rupeesToPaise(input: string | number): number {
  const cleaned = String(input).trim().replace(/,/g, '');
  if (!cleaned) {
    throw new Error('Amount is required.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error('Enter a valid positive number (up to 2 decimal places).');
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Amount must be greater than zero.');
  }
  if (num > 999999999.99) {
    throw new Error('Amount exceeds maximum limit (₹99,99,99,999.99).');
  }
  const parts = cleaned.split('.');
  if (parts.length === 2 && parts[1].length > 2) {
    throw new Error('Amount can have at most 2 decimal places.');
  }
  return Math.round(num * 100);
}

/**
 * Format integer paise using Indian numbering system (e.g., ₹1,25,000 or ₹12,450.50).
 */
export function formatIndianCurrency(
  paise: number,
  symbol = '₹',
  options?: { showDecimals?: boolean; signed?: boolean }
): string {
  const isNeg = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const remPaise = absPaise % 100;

  const s = String(rupees);
  let formattedInt = s;
  if (s.length > 3) {
    const lastThree = s.slice(-3);
    let rest = s.slice(0, -3);
    const groups: string[] = [];
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length > 0) {
      groups.unshift(rest);
    }
    formattedInt = `${groups.join(',')},${lastThree}`;
  }

  const showDec = options?.showDecimals || remPaise > 0;
  const decPart = showDec ? `.${String(remPaise).padStart(2, '0')}` : '';

  let prefix = '';
  if (isNeg) {
    prefix = '-';
  } else if (options?.signed && paise > 0) {
    prefix = '+';
  }

  return `${prefix}${symbol}${formattedInt}${decPart}`;
}

/**
 * Validate YYYY-MM-DD date string and block future dates beyond reference today.
 */
export function validateIsoDate(dateStr: string, todayIso?: string): string {
  const cleaned = dateStr.trim();
  if (!cleaned) {
    throw new Error('Date is required (YYYY-MM-DD).');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new Error('Date must be in YYYY-MM-DD format.');
  }
  const [y, m, d] = cleaned.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    throw new Error('Invalid calendar date.');
  }

  const maxDate = todayIso || getTodayIso();
  if (cleaned > maxDate) {
    throw new Error('Future dates beyond today are not allowed.');
  }
  return cleaned;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (m === 1) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${names[(m - 1 + 12) % 12]} '${String(y).slice(2)}`;
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function generateDemoData(todayIso = getTodayIso()): {
  transactions: Transaction[];
  budgets: Budget[];
} {
  const [refY, refM, refD] = todayIso.split('-').map(Number);
  const templates: Array<[number, number, number, number, number, number]> = [
    [5, 18000, 6400, 7200, 4200, 1500],
    [4, 24000, 9200, 6800, 5100, 800],
    [3, 15000, 5800, 7900, 8400, 2200],
    [2, 32000, 14500, 8400, 6200, 1200],
    [1, 22000, 8900, 9100, 4800, 1900],
    [0, 28500, 11800, 10400, 5600, 2400],
  ];

  const transactions: Transaction[] = [];
  let seq = 1;

  for (const [mBack, freelance, shopping, dining, travel, health] of templates) {
    const totalMonths = refY * 12 + (refM - 1) - mBack;
    const yr = Math.floor(totalMonths / 12);
    const mo = (totalMonths % 12) + 1;
    const monthStr = `${yr}-${String(mo).padStart(2, '0')}`;
    let maxDay = new Date(yr, mo, 0).getDate();
    if (mBack === 0) {
      maxDay = Math.min(maxDay, refD);
    }

    const dStr = (day: number) =>
      `${monthStr}-${String(Math.max(1, Math.min(day, maxDay))).padStart(2, '0')}`;

    const add = (
      type: TransactionType,
      rupees: number,
      category: string,
      day: number,
      note: string
    ) => {
      transactions.push({
        id: `demo-tx-${seq++}`,
        type,
        amountPaise: rupees * 100,
        category,
        date: dStr(day),
        note,
      });
    };

    add(TransactionType.INCOME, 115000, 'Salary', 1, 'Monthly Tech Corp Salary Credit (NEFT)');
    add(TransactionType.INCOME, freelance, 'Freelance', 14, 'UI/UX & Python Sprint Retainer');
    add(TransactionType.EXPENSE, 28000, 'Rent', 3, '2BHK Apartment Rent via UPI');
    add(TransactionType.EXPENSE, 4250, 'Groceries', 5, 'BigBasket Monthly Staples & Produce');
    add(TransactionType.EXPENSE, 3180, 'Groceries', 18, 'FreshMart Organic Dairy & Vegetables');
    add(TransactionType.EXPENSE, Math.floor(dining / 2), 'Food', 8, 'Zomato Weekend Dinner & Artisanal Coffee');
    add(TransactionType.EXPENSE, dining - Math.floor(dining / 2), 'Food', 21, 'Swiggy Team Lunch & Specialty Bakery');
    add(TransactionType.EXPENSE, 3850, 'Bills', 7, 'BESCOM Electricity & Airtel Fiber 300Mbps');
    add(TransactionType.EXPENSE, 3400, 'Fuel', 11, 'IndianOil XP95 Fuel Refill');
    add(TransactionType.EXPENSE, travel, 'Travel', 16, 'Airport Cab & Intercity Express Booking');
    add(TransactionType.EXPENSE, 1499, 'Subscriptions', 12, 'Netflix 4K, Spotify Duo & iCloud+ 200GB');
    add(TransactionType.EXPENSE, 1850, 'Entertainment', 23, 'IMAX Tickets & Live Indie Concert');
    add(TransactionType.EXPENSE, shopping, 'Shopping', 19, 'Amazon Electronics & Running Gear');
    add(TransactionType.EXPENSE, health, 'Health', 25, 'Cult.fit Pass & Pharmacy Essentials');
  }

  const budgets: Budget[] = [
    { category: 'Food', monthlyLimitPaise: 12000 * 100 },
    { category: 'Groceries', monthlyLimitPaise: 9000 * 100 },
    { category: 'Rent', monthlyLimitPaise: 30000 * 100 },
    { category: 'Shopping', monthlyLimitPaise: 12000 * 100 },
    { category: 'Travel', monthlyLimitPaise: 7500 * 100 },
    { category: 'Bills', monthlyLimitPaise: 5000 * 100 },
    { category: 'Fuel', monthlyLimitPaise: 4500 * 100 },
    { category: 'Entertainment', monthlyLimitPaise: 3500 * 100 },
    { category: 'Subscriptions', monthlyLimitPaise: 2000 * 100 },
    { category: 'Health', monthlyLimitPaise: 3500 * 100 },
  ];

  transactions.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return { transactions, budgets };
}

/**
 * Compute summary metrics (balance, income, expense, savingsRate) for a given month or 'ALL'.
 * Safely handles zero income without NaN/Infinity.
 */
export function computeSummaryMetrics(
  transactions: readonly Transaction[],
  month = 'ALL'
): {
  balancePaise: number;
  incomePaise: number;
  expensePaise: number;
  savingsRate: number;
} {
  let incomePaise = 0;
  let expensePaise = 0;

  for (const tx of transactions) {
    if (month !== 'ALL' && !tx.date.startsWith(month)) continue;
    if (tx.type === TransactionType.INCOME) {
      incomePaise += tx.amountPaise;
    } else {
      expensePaise += tx.amountPaise;
    }
  }

  const balancePaise = incomePaise - expensePaise;
  const savingsRate =
    incomePaise <= 0
      ? 0
      : Math.max(-100, Number((((incomePaise - expensePaise) / incomePaise) * 100).toFixed(1)));

  return { balancePaise, incomePaise, expensePaise, savingsRate };
}

/**
 * Compute budget statuses for a given YYYY-MM month.
 * Colour logic: <70% 'ok' (green), 70-99% 'warning' (amber), 100%+ 'danger' (red).
 */
export function computeBudgetStatuses(
  transactions: readonly Transaction[],
  budgets: readonly Budget[],
  month: string
): BudgetStatus[] {
  const spentByCategory: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type === TransactionType.EXPENSE && tx.date.startsWith(month)) {
      spentByCategory[tx.category] = (spentByCategory[tx.category] || 0) + tx.amountPaise;
    }
  }

  const statuses: BudgetStatus[] = budgets.map((b) => {
    const spent = spentByCategory[b.category] || 0;
    const limit = b.monthlyLimitPaise;
    const remaining = limit - spent;
    const pct = limit === 0 ? (spent > 0 ? 100 : 0) : (spent / limit) * 100;
    const level: 'ok' | 'warning' | 'danger' =
      pct >= 100 ? 'danger' : pct >= 70 ? 'warning' : 'ok';
    return {
      category: b.category,
      limitPaise: limit,
      spentPaise: spent,
      remainingPaise: remaining,
      percentUsed: Number(pct.toFixed(1)),
      level,
    };
  });

  statuses.sort((a, b) => b.percentUsed - a.percentUsed);
  return statuses;
}

/**
 * Evaluate whether adding a new expense crosses the 80% or 100% threshold for its category budget.
 */
export function checkBudgetThresholdCrossing(
  existingTransactions: readonly Transaction[],
  budgets: readonly Budget[],
  newTx: Transaction,
  currencySymbol = '₹'
): BudgetAlert | null {
  if (newTx.type !== TransactionType.EXPENSE) return null;
  const budget = budgets.find((b) => b.category === newTx.category);
  if (!budget || budget.monthlyLimitPaise <= 0) return null;

  const month = newTx.date.slice(0, 7);
  let prevSpent = 0;
  for (const tx of existingTransactions) {
    if (
      tx.type === TransactionType.EXPENSE &&
      tx.category === newTx.category &&
      tx.date.startsWith(month)
    ) {
      prevSpent += tx.amountPaise;
    }
  }

  const newSpent = prevSpent + newTx.amountPaise;
  const prevPct = (prevSpent / budget.monthlyLimitPaise) * 100;
  const newPct = (newSpent / budget.monthlyLimitPaise) * 100;

  if (prevPct < 100 && newPct >= 100) {
    return {
      level: 'danger',
      category: newTx.category,
      percent: Number(newPct.toFixed(1)),
      message: `Budget exceeded for ${newTx.category}! Spent ${formatIndianCurrency(newSpent, currencySymbol)} of ${formatIndianCurrency(budget.monthlyLimitPaise, currencySymbol)} (${Math.round(newPct)}%).`,
    };
  }
  if (prevPct < 80 && newPct >= 80) {
    return {
      level: 'warning',
      category: newTx.category,
      percent: Number(newPct.toFixed(1)),
      message: `Heads up: ${newTx.category} budget reached ${Math.round(newPct)}% (${formatIndianCurrency(newSpent, currencySymbol)} / ${formatIndianCurrency(budget.monthlyLimitPaise, currencySymbol)}).`,
    };
  }
  return null;
}

export function computeMonthlyComparison(
  transactions: readonly Transaction[],
  currentMonth: string
): MonthlyComparison {
  const prevMonth = previousMonthKey(currentMonth);
  const curr = computeSummaryMetrics(transactions, currentMonth);
  const prev = computeSummaryMetrics(transactions, prevMonth);

  const expenseChangePct =
    prev.expensePaise === 0
      ? null
      : Number(
          (((curr.expensePaise - prev.expensePaise) / prev.expensePaise) * 100).toFixed(1)
        );

  return {
    currentMonth,
    previousMonth: prevMonth,
    currentIncomePaise: curr.incomePaise,
    previousIncomePaise: prev.incomePaise,
    currentExpensePaise: curr.expensePaise,
    previousExpensePaise: prev.expensePaise,
    expenseChangePct,
  };
}

export function computeCategoryBreakdown(
  transactions: readonly Transaction[],
  month: string
): Array<{ category: string; amountPaise: number; percentage: number }> {
  const map: Record<string, number> = {};
  let total = 0;
  for (const tx of transactions) {
    if (tx.type === TransactionType.EXPENSE && tx.date.startsWith(month)) {
      map[tx.category] = (map[tx.category] || 0) + tx.amountPaise;
      total += tx.amountPaise;
    }
  }
  return Object.entries(map)
    .filter(([, amt]) => amt > 0)
    .map(([category, amountPaise]) => ({
      category,
      amountPaise,
      percentage: total > 0 ? Number(((amountPaise / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
}

export function computeDailyCumulativeSeries(
  transactions: readonly Transaction[],
  month: string
): Array<{ day: number; dailyPaise: number; cumulativePaise: number }> {
  const numDays = daysInMonth(month);
  const dailyMap: Record<number, number> = {};
  for (const tx of transactions) {
    if (tx.type === TransactionType.EXPENSE && tx.date.startsWith(month)) {
      const d = Number(tx.date.slice(8, 10));
      if (d >= 1 && d <= numDays) {
        dailyMap[d] = (dailyMap[d] || 0) + tx.amountPaise;
      }
    }
  }

  let cumulative = 0;
  const series: Array<{ day: number; dailyPaise: number; cumulativePaise: number }> = [];
  for (let d = 1; d <= numDays; d++) {
    const daily = dailyMap[d] || 0;
    cumulative += daily;
    series.push({ day: d, dailyPaise: daily, cumulativePaise: cumulative });
  }
  return series;
}

export function computeInsights(
  transactions: readonly Transaction[],
  budgets: readonly Budget[],
  month: string,
  currencySymbol = '₹'
): string[] {
  const breakdown = computeCategoryBreakdown(transactions, month);
  if (breakdown.length === 0) {
    return ['No expenses recorded for this month yet. Add transactions to unlock computed insights.'];
  }

  const insights: string[] = [];
  const top = breakdown[0];
  const prevMonth = previousMonthKey(month);
  const prevBreakdown = computeCategoryBreakdown(transactions, prevMonth);
  const prevTopItem = prevBreakdown.find((b) => b.category === top.category);

  if (prevTopItem && prevTopItem.amountPaise > 0) {
    const diffPct =
      ((top.amountPaise - prevTopItem.amountPaise) / prevTopItem.amountPaise) * 100;
    const dir = diffPct >= 0 ? 'higher' : 'lower';
    insights.push(
      `${top.category} is ${Math.round(top.percentage)}% of your spending, ${Math.round(Math.abs(diffPct))}% ${dir} than last month.`
    );
  } else {
    insights.push(
      `${top.category} is your largest expense at ${Math.round(top.percentage)}% (${formatIndianCurrency(top.amountPaise, currencySymbol)}) this month.`
    );
  }

  const metrics = computeSummaryMetrics(transactions, month);
  if (metrics.incomePaise > 0) {
    if (metrics.savingsRate >= 25) {
      insights.push(
        `Strong savings discipline: you saved ${metrics.savingsRate.toFixed(1)}% of your income (${formatIndianCurrency(metrics.balancePaise, currencySymbol)} net positive).`
      );
    } else if (metrics.savingsRate >= 0) {
      const save15 = Math.round(top.amountPaise * 0.15);
      insights.push(
        `Your savings rate is ${metrics.savingsRate.toFixed(1)}% this month. Trimming ${top.category} by 15% would save ${formatIndianCurrency(save15, currencySymbol)}.`
      );
    } else {
      insights.push(
        `Expenses exceeded income by ${formatIndianCurrency(Math.abs(metrics.balancePaise), currencySymbol)} this month.`
      );
    }
  }

  const statuses = computeBudgetStatuses(transactions, budgets, month);
  const over = statuses.filter((s) => s.level === 'danger');
  if (over.length > 0) {
    insights.push(
      `${over.length} category (${over.slice(0, 2).map((o) => o.category).join(', ')}) has crossed 100% of its monthly budget limit.`
    );
  } else if (statuses.length > 0) {
    insights.push(
      `All ${statuses.length} budgeted categories are within their monthly limits for ${month}.`
    );
  }

  return insights;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TransactionType,
  rupeesToPaise,
  formatIndianCurrency,
  validateIsoDate,
  computeSummaryMetrics,
  computeBudgetStatuses,
  checkBudgetThresholdCrossing,
  generateDemoData,
  computeInsights,
} from './finpilotStore';

test('rupeesToPaise converts valid amounts and rejects invalid/negative/3-decimal inputs', () => {
  assert.equal(rupeesToPaise('125000'), 12500000);
  assert.equal(rupeesToPaise('1,25,000.50'), 12500050);
  assert.equal(rupeesToPaise(49.99), 4999);

  assert.throws(() => rupeesToPaise(''), /Amount is required/);
  assert.throws(() => rupeesToPaise('-50'), /greater than zero/);
  assert.throws(() => rupeesToPaise('0'), /greater than zero/);
  assert.throws(() => rupeesToPaise('12.345'), /at most 2 decimal places/);
});

test('formatIndianCurrency groups digits in Indian lakhs and crores format', () => {
  assert.equal(formatIndianCurrency(12500000, '₹'), '₹1,25,000');
  assert.equal(formatIndianCurrency(1000000000, '₹'), '₹1,00,00,000');
  assert.equal(formatIndianCurrency(95050, '₹'), '₹950.50');
  assert.equal(
    formatIndianCurrency(-250000, '₹', { signed: true }),
    '-₹2,500'
  );
  assert.equal(
    formatIndianCurrency(250000, '₹', { signed: true }),
    '+₹2,500'
  );
});

test('validateIsoDate accepts valid past/today dates and blocks future dates', () => {
  assert.equal(validateIsoDate('2026-10-15', '2026-10-22'), '2026-10-15');
  assert.equal(validateIsoDate('2026-10-22', '2026-10-22'), '2026-10-22');
  assert.throws(
    () => validateIsoDate('2026-10-25', '2026-10-22'),
    /Future dates beyond today/
  );
  assert.throws(
    () => validateIsoDate('2026-02-30', '2026-10-22'),
    /Invalid calendar date/
  );
});

test('computeSummaryMetrics handles zero income gracefully without division error', () => {
  const emptyMetrics = computeSummaryMetrics([], 'ALL');
  assert.equal(emptyMetrics.balancePaise, 0);
  assert.equal(emptyMetrics.savingsRate, 0);

  const expenseOnly = computeSummaryMetrics(
    [
      {
        id: '1',
        type: TransactionType.EXPENSE,
        amountPaise: 50000,
        category: 'Food',
        note: 'Lunch',
        date: '2026-10-10',
      },
    ],
    '2026-10'
  );
  assert.equal(expenseOnly.balancePaise, -50000);
  assert.equal(expenseOnly.savingsRate, 0);
});

test('computeBudgetStatuses & checkBudgetThresholdCrossing trigger at 80% and 100%', () => {
  const budgets = [{ category: 'Food', monthlyLimitPaise: 100000 }]; // ₹1,000
  const existing = [
    {
      id: 't1',
      type: TransactionType.EXPENSE,
      amountPaise: 75000, // 75%
      category: 'Food',
      note: 'Dinner',
      date: '2026-10-05',
    },
  ];

  // Crossing 80%
  const tx85 = {
    id: 't2',
    type: TransactionType.EXPENSE,
    amountPaise: 10000, // brings to 85%
    category: 'Food',
    note: 'Snacks',
    date: '2026-10-06',
  };
  const alert80 = checkBudgetThresholdCrossing(existing, budgets, tx85);
  assert.ok(alert80);
  assert.equal(alert80.level, 'warning');

  // Crossing 100%
  const tx105 = {
    id: 't3',
    type: TransactionType.EXPENSE,
    amountPaise: 30000, // brings from 75% to 105%
    category: 'Food',
    note: 'Party',
    date: '2026-10-07',
  };
  const alert100 = checkBudgetThresholdCrossing(existing, budgets, tx105);
  assert.ok(alert100);
  assert.equal(alert100.level, 'danger');

  const statuses = computeBudgetStatuses([...existing, tx105], budgets, '2026-10');
  assert.equal(statuses[0].level, 'danger');
  assert.equal(statuses[0].percentUsed, 105);
});

test('generateDemoData produces 6 months of transactions and computed insights', () => {
  const { transactions, budgets } = generateDemoData('2026-10-22');
  assert.ok(transactions.length >= 70);
  assert.ok(budgets.length >= 8);
  const insights = computeInsights(transactions, budgets, '2026-10');
  assert.ok(insights.length >= 2);
});

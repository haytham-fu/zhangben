import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: new URL('../src/utils/budget.ts', import.meta.url).pathname, platform: 'node' });
const { output } = await bundle.generate({ format: 'esm' });
const { monthPaceSnapshot, buildAdvice } = await import(
  `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`
);

const settings = {
  basicBudget: 3100, specialBudget: 1550, includeSpecialInAdvice: true,
  dailyPlan: { mon: 100, tue: 100, wed: 100, thu: 100, fri: 100, satPlay: 100, satStay: 100, sun: 100 },
  satModeOverrides: {}, defaultSatMode: 'stay', monthOpening: null,
};
const tx = (id, date, amountRmb, overrides = {}) => ({
  id, date, amountRmb, type: 'expense', kind: 'normal', bucket: 'basic',
  categoryId: 'food', isSpecial: false, ...overrides,
});

test('calendar pace includes both buckets but excludes future transactions and grocery stock purchase', () => {
  const rows = [
    tx('meal', '2026-10-01', 60),
    tx('special', '2026-10-02', 40, { bucket: 'special' }),
    tx('income', '2026-10-02', 10, { type: 'income' }),
    tx('stock', '2026-10-02', 50, { isGroceryPurchase: true }),
    tx('future', '2026-10-20', 200),
  ];
  const s = monthPaceSnapshot(rows, settings, '2026-10', new Date(2026, 9, 2), { includeSpecial: true });
  assert.equal(s.elapsedDays, 2);
  assert.equal(s.pacedBudget, 300);
  assert.equal(s.totalUsed, 90);
  assert.equal(s.paceDifference, 210);
  assert.equal(s.totalRemaining, 4560);
  assert.ok(buildAdvice(rows, settings, '2026-10', new Date(2026, 9, 2)).some((line) => line.includes('每天可用')));
});

test('spread expenses count only elapsed portions and opening balances count once', () => {
  const withOpening = { ...settings, monthOpening: { ym: '2026-10', basicUsed: 20, specialUsed: 0 } };
  const rows = [tx('shampoo', '2026-10-01', 30, { categoryId: 'sundries', bucket: 'special', spreadDays: 3 })];
  const s = monthPaceSnapshot(rows, withOpening, '2026-10', new Date(2026, 9, 2), { includeSpecial: true });
  assert.equal(s.basicUsed, 20);
  assert.equal(s.specialUsed, 20);
  assert.equal(s.totalUsed, 40);
});

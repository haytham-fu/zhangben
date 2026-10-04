import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: new URL('../src/utils/budget.ts', import.meta.url).pathname, platform: 'node' });
const { output } = await bundle.generate({ format: 'esm' });
const { dayNetBasic, expenseInMonth, expenseOnDate, monthBasicUsed } = await import(
  `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`
);

const settings = { monthOpening: null, includeSpecialInAdvice: true };
const opts = { includeSpecial: true };
const ac = (date, amountRmb, spreadDays) => ({
  id: 'ac-1', date, amountRmb, spreadDays,
  categoryId: 'ac', type: 'expense', kind: 'normal', bucket: 'basic',
});

test('ten-day air conditioning payment counts only one tenth each day', () => {
  const tx = ac('2026-10-04', 100, 10);
  assert.equal(dayNetBasic([tx], '2026-10-04', opts), 10);
  assert.equal(dayNetBasic([tx], '2026-10-05', opts), 10);
  assert.equal(dayNetBasic([tx], '2026-10-13', opts), 10);
  assert.equal(dayNetBasic([tx], '2026-10-14', opts), 0);
  assert.equal(monthBasicUsed([tx], settings, '2026-10', opts), 100);
});

test('fractional cents and a month boundary add back to the exact payment', () => {
  const tx = ac('2026-10-30', 100.01, 3);
  assert.equal(expenseOnDate(tx, '2026-10-30'), 33.34);
  assert.equal(expenseOnDate(tx, '2026-10-31'), 33.34);
  assert.equal(expenseOnDate(tx, '2026-11-01'), 33.33);
  assert.equal(expenseInMonth(tx, '2026-10'), 66.68);
  assert.equal(expenseInMonth(tx, '2026-11'), 33.33);
});

test('old air conditioning entries stay on their original day until edited', () => {
  const tx = ac('2026-10-04', 100, undefined);
  assert.equal(dayNetBasic([tx], '2026-10-04', opts), 100);
  assert.equal(dayNetBasic([tx], '2026-10-05', opts), 0);
});

test('Octopus recharge is excluded; actual Octopus spending counts once', () => {
  const topup = {
    id: 'topup-1', date: '2026-10-04', amountRmb: 86,
    categoryId: 'octopus_topup', type: 'expense', kind: 'topup', bucket: 'basic',
    paymentMethod: 'octopus',
  };
  const ride = {
    id: 'ride-1', date: '2026-10-05', amountRmb: 5,
    categoryId: 'transport', type: 'expense', kind: 'normal', bucket: 'basic',
    paymentMethod: 'octopus',
  };
  assert.equal(dayNetBasic([topup, ride], '2026-10-04', opts), 0);
  assert.equal(dayNetBasic([topup, ride], '2026-10-05', opts), 5);
  assert.equal(monthBasicUsed([topup, ride], settings, '2026-10', opts), 5);
});

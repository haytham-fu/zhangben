import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

async function bundled(path) {
  const bundle = await rolldown({ input: new URL(path, import.meta.url).pathname, platform: 'node' });
  const { output } = await bundle.generate({ format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);
}

const { materializeDailyFixed, mergeDailyFixedExpenses, normalizeDailyFixedExpenses } =
  await bundled('../src/utils/dailyFixed.ts');
const { dayNetAll, dayNetBasic, monthBasicUsed } = await bundled('../src/utils/budget.ts');
const { createPigWallet, settleClosedMonths } = await bundled('../src/utils/wallets.ts');

const rule = {
  id: 'rule-1', name: '空调日费', amountRmb: 10,
  categoryId: 'ac', bucket: 'basic', startDate: '2026-09-29',
  updatedAt: '2026-09-29T00:00:00.000Z',
};
const state = (rules = [rule], transactions = []) => ({
  settings: { dailyFixedExpenses: rules, monthOpening: null, includeSpecialInAdvice: true },
  transactions, categories: [], wallets: [], pantryItems: [],
});
const opts = { includeSpecial: true };

test('missed days are caught up once, including the month boundary', () => {
  const opened = materializeDailyFixed(state(), '2026-10-02');
  assert.deepEqual(opened.transactions.map((t) => t.date),
    ['2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29']);
  assert.equal(dayNetBasic(opened.transactions, '2026-10-01', opts), 10);
  assert.equal(dayNetAll(opened.transactions, '2026-10-01', opts), 10);
  assert.equal(monthBasicUsed(opened.transactions, opened.settings, '2026-09', opts), 20);
  assert.equal(monthBasicUsed(opened.transactions, opened.settings, '2026-10', opts), 20);
  assert.equal(materializeDailyFixed(opened, '2026-10-02'), opened);
  assert.equal(materializeDailyFixed(opened, '2026-10-03').transactions.length, 5);
});

test('stopping a rule removes today, preserves past, and blocks future charges', () => {
  const opened = materializeDailyFixed(state(), '2026-10-02');
  const stopped = { ...rule, stoppedOn: '2026-10-02', updatedAt: '2026-10-02T09:00:00.000Z' };
  const afterStop = materializeDailyFixed({ ...opened, settings: {
    ...opened.settings, dailyFixedExpenses: [stopped],
  } }, '2026-10-02');
  assert.deepEqual(afterStop.transactions.map((t) => t.date),
    ['2026-10-01', '2026-09-30', '2026-09-29']);
  assert.equal(dayNetBasic(afterStop.transactions, '2026-10-02', opts), 0);
  assert.equal(materializeDailyFixed(afterStop, '2026-10-10'), afterStop);
});

test('future start does not charge early, and two rules remain independent', () => {
  const future = { ...rule, id: 'future', name: '座机空调', startDate: '2026-10-09', amountRmb: 6 };
  const active = { ...rule, id: 'second', categoryId: 'sundries', bucket: 'special' };
  const opened = materializeDailyFixed(state([future, active]), '2026-10-08');
  assert.equal(opened.transactions.some((t) => t.dailyFixedRuleId === 'future'), false);
  assert.equal(dayNetAll(opened.transactions, '2026-10-08', opts), 10);
  const tomorrow = materializeDailyFixed(opened, '2026-10-09');
  assert.equal(dayNetAll(tomorrow.transactions, '2026-10-09', opts), 16);
  assert.equal(dayNetBasic(tomorrow.transactions, '2026-10-09', opts), 6);
});

test('a future rule cancelled before its start stays cancelled after backup normalization', () => {
  const future = { ...rule, id: 'future', startDate: '2026-10-09',
    stoppedOn: '2026-10-08', updatedAt: '2026-10-08T09:00:00.000Z' };
  const [restored] = normalizeDailyFixedExpenses([future]);
  assert.equal(restored.stoppedOn, '2026-10-08');
  assert.equal(materializeDailyFixed(state([restored]), '2026-10-20').transactions.length, 0);
});

test('sync keeps a newer stop instead of reactivating a stale rule', () => {
  const stopped = { ...rule, stoppedOn: '2026-10-02', updatedAt: '2026-10-02T09:00:00.000Z' };
  assert.deepEqual(mergeDailyFixedExpenses([stopped], [rule]), [stopped]);
});

test('a synced edit refreshes only today, leaving historic daily amounts intact', () => {
  const opened = materializeDailyFixed(state(), '2026-10-02');
  const edited = { ...rule, amountRmb: 12, name: '空调新日费',
    updatedAt: '2026-10-02T09:00:00.000Z' };
  const synced = materializeDailyFixed({
    ...opened, settings: { ...opened.settings, dailyFixedExpenses: [edited] },
  }, '2026-10-02');
  assert.equal(dayNetBasic(synced.transactions, '2026-10-02', opts), 12);
  assert.equal(dayNetBasic(synced.transactions, '2026-10-01', opts), 10);
  assert.equal(materializeDailyFixed(synced, '2026-10-02'), synced);
});

test('caught-up daily expenses are counted before month-end pig settlement', () => {
  const before = state();
  before.settings.basicBudget = 3500;
  before.settings.specialBudget = 1500;
  before.wallets = [createPigWallet()];
  const caughtUp = materializeDailyFixed(before, '2026-10-02');
  const closed = settleClosedMonths(caughtUp, '2026-10');
  assert.equal(closed.wallets[0].balance, 4980);
  assert.deepEqual(closed.settings.settledMonths, ['2026-09']);
  assert.equal(settleClosedMonths(closed, '2026-10'), closed);
});

test('invalid imported rules are ignored', () => {
  const imported = normalizeDailyFixedExpenses([rule, { ...rule, id: 'bad', amountRmb: -1 },
    { ...rule, id: 'invalid-date', startDate: '2026-02-30' }]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].id, 'rule-1');
});

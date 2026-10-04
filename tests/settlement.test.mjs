import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: new URL('../src/utils/wallets.ts', import.meta.url).pathname, platform: 'node' });
const { output } = await bundle.generate({ format: 'esm' });
const { createPigWallet, reconcileSettledAcExpense, settleClosedMonths } = await import(
  `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`
);

function state(transactions, wallets = [createPigWallet()], settledMonths = []) {
  return {
    settings: {
      basicBudget: 3500,
      specialBudget: 1500,
      includeSpecialInAdvice: true,
      settledMonths,
      monthOpening: null,
    },
    transactions,
    wallets,
    categories: [],
    pantryItems: [],
  };
}

function tx(date, amountRmb, type = 'expense', walletId = null) {
  return {
    id: `${date}-${amountRmb}-${type}`,
    date,
    amountRmb,
    type,
    kind: 'normal',
    bucket: 'basic',
    walletId,
  };
}

test('September surplus transfers on an October open, once only', () => {
  const before = state([tx('2026-09-10', 2000), tx('2026-09-20', 100, 'income')]);
  const after = settleClosedMonths(before, '2026-10');
  assert.equal(after.wallets[0].balance, 3100);
  assert.deepEqual(after.settings.settledMonths, ['2026-09']);
  assert.equal(after.wallets[0].transfers[0].ym, '2026-09');
  assert.equal(settleClosedMonths(after, '2026-10'), after);
});

test('overspend deducts from the pig, while current month is left open', () => {
  const after = settleClosedMonths(state([
    tx('2026-09-10', 5500), tx('2026-10-01', 50),
  ]), '2026-10');
  assert.equal(after.wallets[0].balance, -500);
  assert.deepEqual(after.settings.settledMonths, ['2026-09']);
  assert.equal(after.wallets[0].transfers[0].direction, 'out');
});

test('later jar transfers and spending do not change September settlement', () => {
  const jar = {
    id: 'jar-1',
    name: '存钱罐',
    bucket: 'custom',
    color: '#3B82F6',
    balance: 300,
    createdAt: '2026-09-01T00:00:00.000Z',
    transfers: [
      { id: 'oct', direction: 'in', amount: 100, source: 'total', ym: '2026-10', createdAt: '2026-10-02T00:00:00.000Z' },
      { id: 'sep', direction: 'in', amount: 500, source: 'total', ym: '2026-09', createdAt: '2026-09-15T00:00:00.000Z' },
    ],
  };
  const after = settleClosedMonths(state([
    tx('2026-09-18', 100, 'expense', jar.id),
    tx('2026-10-02', 200, 'expense', jar.id),
  ], [createPigWallet(), jar]), '2026-10');
  assert.equal(after.wallets[0].balance, 4500);
  assert.equal(after.wallets[1].balance, 300);
});

test('an existing settlement transfer is never duplicated', () => {
  const pig = createPigWallet();
  pig.balance = 3100;
  pig.transfers = [{
    id: 'prior', direction: 'in', amount: 3100, source: 'settle',
    ym: '2026-09', createdAt: '2026-10-01T00:00:00.000Z',
  }];
  const after = settleClosedMonths(state([tx('2026-09-10', 1900)], [pig]), '2026-10');
  assert.equal(after.wallets[0].balance, 3100);
  assert.equal(after.wallets[0].transfers.length, 1);
  assert.deepEqual(after.settings.settledMonths, ['2026-09']);
});

test('opening an empty month tracks it without crediting older months', () => {
  const before = state([]);
  const opened = settleClosedMonths(before, '2026-10');
  assert.deepEqual(opened.settings.activeBudgetMonths, ['2026-10']);
  assert.equal(opened.wallets[0].balance, 0);
  assert.deepEqual(opened.settings.settledMonths, []);
  const nextMonth = settleClosedMonths(opened, '2026-11');
  assert.equal(nextMonth.wallets[0].balance, 5000);
  assert.deepEqual(nextMonth.settings.settledMonths, ['2026-10']);
});

test('editing an old air-conditioning payment corrects a settled month once', () => {
  const pig = createPigWallet();
  pig.balance = 1000;
  const original = {
    ...tx('2026-09-30', 100), categoryId: 'ac',
  };
  const spread = { ...original, spreadDays: 10 };
  const wallets = reconcileSettledAcExpense(
    state([], [pig], ['2026-09']).settings, [pig], original, spread,
  );
  assert.equal(wallets[0].balance, 1090);
  assert.equal(wallets[0].transfers[0].ym, '2026-09');
  assert.equal(wallets[0].transfers[0].amount, 90);
});

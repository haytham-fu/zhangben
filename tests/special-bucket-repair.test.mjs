import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: new URL('../src/utils/specialBucketRepair.ts', import.meta.url).pathname, platform: 'node' });
const { output } = await bundle.generate({ format: 'esm' });
const { repairLegacySpecialBuckets } = await import(
  `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`
);
const storageBundle = await rolldown({ input: new URL('../src/utils/storage.ts', import.meta.url).pathname, platform: 'node' });
const storageOutput = await storageBundle.generate({ format: 'esm' });
const { importJson } = await import(
  `data:text/javascript;base64,${Buffer.from(storageOutput.output[0].code).toString('base64')}`
);

const state = () => ({
  settings: {},
  categories: [
    { id: 'food', bucket: 'basic' },
    { id: 'sundries', bucket: 'special' },
    { id: 'hobbies', bucket: 'special' },
  ],
  transactions: [
    { id: 'shampoo', type: 'expense', kind: 'normal', categoryId: 'sundries', bucket: 'basic' },
    { id: 'model', type: 'expense', kind: 'normal', categoryId: 'hobbies', bucket: 'basic' },
    { id: 'meal', type: 'expense', kind: 'normal', categoryId: 'food', bucket: 'basic' },
    { id: 'income', type: 'income', kind: 'normal', categoryId: 'hobbies', bucket: 'basic' },
    { id: 'monthly', type: 'expense', kind: 'normal', categoryId: 'food', bucket: 'basic', isMonthly: true },
  ],
});

test('old special-category expenses move once without changing amounts or unrelated entries', () => {
  const original = state();
  const fixed = repairLegacySpecialBuckets(original);
  assert.deepEqual(fixed.transactions.map((tx) => tx.bucket),
    ['special', 'special', 'basic', 'basic', 'special']);
  assert.deepEqual(fixed.transactions.map((tx) => tx.id), original.transactions.map((tx) => tx.id));
  assert.equal(fixed.settings.specialBucketRepairVersion, 1);
  assert.equal(repairLegacySpecialBuckets(fixed), fixed);
});

test('later intentional basic override is not repeatedly migrated', () => {
  const fixed = repairLegacySpecialBuckets(state());
  const edited = { ...fixed, transactions: fixed.transactions.map((tx) =>
    tx.id === 'model' ? { ...tx, bucket: 'basic' } : tx) };
  assert.equal(repairLegacySpecialBuckets(edited).transactions.find((tx) => tx.id === 'model').bucket, 'basic');
});

test('importing an old backup applies the same correction automatically', () => {
  const restored = importJson(JSON.stringify(state()));
  assert.equal(restored.transactions.find((tx) => tx.id === 'shampoo').bucket, 'special');
  assert.equal(restored.transactions.find((tx) => tx.id === 'meal').bucket, 'basic');
  assert.equal(restored.settings.specialBucketRepairVersion, 1);
});

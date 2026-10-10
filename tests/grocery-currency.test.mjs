import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolldown } from 'rolldown';

const bundle = await rolldown({
  input: new URL('../src/utils/grocery.ts', import.meta.url).pathname,
  platform: 'node',
});
const { output } = await bundle.generate({ format: 'esm' });
const { groceryCostRmb, costPerMeal, nextPantryMealCost, roundMoney } = await import(
  `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`
);

test('each grocery price converts independently before meal allocation', () => {
  const vegetable = groceryCostRmb(12, 0.86, false);
  const rice = groceryCostRmb(6, 1, false);
  assert.equal(vegetable, 10.32);
  assert.equal(rice, 6);
  assert.equal(roundMoney(costPerMeal(vegetable, 3) + costPerMeal(rice, 3)), 5.44);
});

test('AA share converts only once and final meal clears rounding remainder', () => {
  const costRmb = groceryCostRmb(5.1, 0.86, true);
  assert.equal(costRmb, 2.19);
  const item = { costRmb, costPerMeal: costPerMeal(costRmb, 2), mealsTotal: 2, mealsLeft: 1 };
  assert.equal(nextPantryMealCost(item), 1.09);
});

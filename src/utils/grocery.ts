import type { GroceryKind, PantryItem } from '../types';

export interface GroceryKindOption {
  kind: GroceryKind;
  label: string;
  icon: string;
}

/** 买菜品类芯片（可点选） */
export const GROCERY_KIND_OPTIONS: GroceryKindOption[] = [
  { kind: 'veg', label: '蔬菜', icon: '🥬' },
  { kind: 'meat', label: '肉类', icon: '🥩' },
  { kind: 'egg', label: '蛋', icon: '🥚' },
  { kind: 'staple', label: '主食', icon: '🍚' },
  { kind: 'fruit', label: '水果', icon: '🍎' },
  { kind: 'seasoning', label: '调料', icon: '🧂' },
];

/**
 * 调料建议顿数（估算，小瓶/小包装；可在代码中调常量）
 * 仅作参考，实际以用户填写为准。
 */
export const SEASONING_MEAL_SUGGESTIONS: { name: string; meals: number }[] = [
  { name: '食用油', meals: 60 },
  { name: '生抽', meals: 40 },
  { name: '老抽', meals: 50 },
  { name: '盐', meals: 80 },
  { name: '糖', meals: 50 },
  { name: '香醋', meals: 40 },
  { name: '蚝油', meals: 30 },
  { name: '酱油', meals: 40 },
];

export function kindLabel(kind: GroceryKind): string {
  if (kind === 'custom') return '自定义';
  return GROCERY_KIND_OPTIONS.find((k) => k.kind === kind)?.label ?? kind;
}

export function kindIcon(kind: GroceryKind): string {
  if (kind === 'custom') return '🛒';
  return GROCERY_KIND_OPTIONS.find((k) => k.kind === kind)?.icon ?? '🛒';
}

export function suggestMealsForSeasoning(name: string): number | null {
  const n = name.trim();
  if (!n) return null;
  const hit = SEASONING_MEAL_SUGGESTIONS.find(
    (s) => n === s.name || n.includes(s.name) || s.name.includes(n),
  );
  return hit?.meals ?? null;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function costPerMeal(costRmb: number, meals: number): number {
  if (meals <= 0) return 0;
  return roundMoney(costRmb / meals);
}

/** 每顿均价：各品（金额/顿数）相加 */
export function purchaseCostPerMeal(
  items: { costRmb: number; meals: number }[],
): number {
  return roundMoney(items.reduce((s, it) => s + costPerMeal(it.costRmb, it.meals), 0));
}

export function purchaseTotalCost(items: { costRmb: number }[]): number {
  return roundMoney(items.reduce((s, it) => s + (it.costRmb || 0), 0));
}

export function purchaseMaxMeals(items: { meals: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((it) => it.meals || 0));
}

export function activePantryItems(items: PantryItem[]): PantryItem[] {
  return items
    .filter((p) => p.mealsLeft > 0.001)
    .sort((a, b) => b.boughtDate.localeCompare(a.boughtDate) || a.name.localeCompare(b.name));
}

export function pantryRemainingValue(items: PantryItem[]): number {
  return roundMoney(
    items.reduce((s, p) => s + p.costPerMeal * Math.max(0, p.mealsLeft), 0),
  );
}

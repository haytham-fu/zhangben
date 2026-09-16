import type { GroceryKind, PantryItem } from '../types';
import {
  estimateFromCapacity,
  findProductProfile,
  seasoningProfiles,
  type CapUnit,
} from './capacityEstimate';

export interface GroceryKindOption {
  kind: GroceryKind;
  label: string;
  icon: string;
}

/** 买菜品类（可点选） */
export const GROCERY_KIND_OPTIONS: GroceryKindOption[] = [
  { kind: 'veg', label: '蔬菜', icon: '🥬' },
  { kind: 'meat', label: '肉类', icon: '🥩' },
  { kind: 'egg', label: '蛋', icon: '🥚' },
  { kind: 'staple', label: '主食', icon: '🍚' },
  { kind: 'fruit', label: '水果', icon: '🍎' },
  { kind: 'seasoning', label: '调料', icon: '🧂' },
];

/** Quick chips: name only; meals come from capacity estimate */
export const SEASONING_MEAL_SUGGESTIONS: { name: string; meals: number }[] =
  seasoningProfiles().map((p) => ({
    name: p.name,
    meals: estimateFromCapacity(p, 1, '瓶')?.count ?? 30,
  }));

export function kindLabel(kind: GroceryKind): string {
  if (kind === 'custom') return '自定义';
  return GROCERY_KIND_OPTIONS.find((k) => k.kind === kind)?.label ?? kind;
}

export function kindIcon(kind: GroceryKind): string {
  if (kind === 'custom') return '🛒';
  return GROCERY_KIND_OPTIONS.find((k) => k.kind === kind)?.icon ?? '🛒';
}

/** Fallback when no capacity entered: 1 bottle conservative estimate */
export function suggestMealsForSeasoning(name: string): number | null {
  const profile = findProductProfile(name);
  if (!profile || profile.family !== 'seasoning') return null;
  return estimateFromCapacity(profile, 1, '瓶')?.count ?? null;
}

export function estimateSeasoningMeals(
  name: string,
  amount: number,
  unit: CapUnit,
): number | null {
  const profile = findProductProfile(name);
  if (!profile || profile.family !== 'seasoning') return null;
  return estimateFromCapacity(profile, amount, unit)?.count ?? null;
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

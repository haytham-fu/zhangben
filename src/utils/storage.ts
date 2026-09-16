import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, STORAGE_KEY } from './defaults';
import type { AppState, Category, Settings, Transaction } from '../types';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  const data = safeParse<Partial<AppState>>(localStorage.getItem(STORAGE_KEY));
  return {
    settings: { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) },
    transactions: Array.isArray(data?.transactions) ? data!.transactions! : [],
    categories:
      Array.isArray(data?.categories) && data!.categories!.length > 0
        ? data!.categories!
        : DEFAULT_CATEGORIES,
  };
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(raw: string): AppState {
  const data = JSON.parse(raw) as Partial<AppState>;
  return {
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    transactions: Array.isArray(data.transactions) ? (data.transactions as Transaction[]) : [],
    categories: Array.isArray(data.categories)
      ? (data.categories as Category[])
      : DEFAULT_CATEGORIES,
  };
}

export function mergeSettings(partial: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

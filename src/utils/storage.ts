import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, DEFAULT_WALLETS, STORAGE_KEY } from './defaults';
import type { AppState, Category, Settings, Transaction, Wallet } from '../types';
import { normalizeWallet } from './wallets';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeTransactions(list: unknown): Transaction[] {
  if (!Array.isArray(list)) return [];
  return list.map((t) => {
    const tx = t as Transaction;
    return {
      ...tx,
      walletId: tx.walletId ?? null,
    };
  });
}

function normalizeWallets(list: unknown): Wallet[] {
  if (!Array.isArray(list)) return [...DEFAULT_WALLETS];
  const out: Wallet[] = [];
  for (const item of list) {
    const w = normalizeWallet(item as Partial<Wallet>);
    if (w) out.push(w);
  }
  return out;
}

export function loadState(): AppState {
  const data = safeParse<Partial<AppState>>(localStorage.getItem(STORAGE_KEY));
  return {
    settings: { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) },
    transactions: normalizeTransactions(data?.transactions),
    categories:
      Array.isArray(data?.categories) && data!.categories!.length > 0
        ? data!.categories!
        : DEFAULT_CATEGORIES,
    wallets: data?.wallets != null ? normalizeWallets(data.wallets) : [...DEFAULT_WALLETS],
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
    transactions: normalizeTransactions(data.transactions),
    categories: Array.isArray(data.categories)
      ? (data.categories as Category[])
      : DEFAULT_CATEGORIES,
    wallets: data.wallets != null ? normalizeWallets(data.wallets) : [...DEFAULT_WALLETS],
  };
}

export function mergeSettings(partial: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

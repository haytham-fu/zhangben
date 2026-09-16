import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, DEFAULT_WALLETS, STORAGE_KEY } from './defaults';
import type { AppState, Category, ForeignCurrency, Settings, Transaction, Wallet } from '../types';
import {
  DEFAULT_FIXED_RATES,
  FOREIGN_CURRENCIES,
  isCurrency,
  isForeignCurrency,
  normalizePreferredCurrencies,
} from './currency';
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
    const tx = t as Transaction & { currency?: string };
    const currency = isCurrency(tx.currency) ? tx.currency : 'RMB';
    return {
      ...tx,
      currency,
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

/** Migrate legacy hkdRate/usdRate/liveHkdRate/liveUsdRate → fixedRates/liveRates. */
export function normalizeSettings(raw: unknown): Settings {
  const partial = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings> & {
    hkdRate?: number;
    usdRate?: number;
    liveHkdRate?: number | null;
    liveUsdRate?: number | null;
  };

  const fixedRates: Record<ForeignCurrency, number> = { ...DEFAULT_FIXED_RATES };
  if (partial.fixedRates && typeof partial.fixedRates === 'object') {
    for (const fc of FOREIGN_CURRENCIES) {
      const v = (partial.fixedRates as Record<string, number>)[fc];
      if (typeof v === 'number' && v > 0) fixedRates[fc] = v;
    }
  }
  if (typeof partial.hkdRate === 'number' && partial.hkdRate > 0) {
    fixedRates.HKD = partial.hkdRate;
  }
  if (typeof partial.usdRate === 'number' && partial.usdRate > 0) {
    fixedRates.USD = partial.usdRate;
  }

  const liveRates: Partial<Record<ForeignCurrency, number>> = {};
  if (partial.liveRates && typeof partial.liveRates === 'object') {
    for (const [k, v] of Object.entries(partial.liveRates)) {
      if (isForeignCurrency(k) && typeof v === 'number' && v > 0) liveRates[k] = v;
    }
  }
  if (typeof partial.liveHkdRate === 'number' && partial.liveHkdRate > 0) {
    liveRates.HKD = partial.liveHkdRate;
  }
  if (typeof partial.liveUsdRate === 'number' && partial.liveUsdRate > 0) {
    liveRates.USD = partial.liveUsdRate;
  }

  const {
    hkdRate: _h,
    usdRate: _u,
    liveHkdRate: _lh,
    liveUsdRate: _lu,
    fixedRates: _fr,
    liveRates: _lr,
    preferredCurrencies: _pc,
    ...rest
  } = partial;

  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    fixedRates,
    liveRates,
    liveRatesUpdatedAt:
      typeof partial.liveRatesUpdatedAt === 'string' ? partial.liveRatesUpdatedAt : null,
    preferredCurrencies: normalizePreferredCurrencies(partial.preferredCurrencies),
    fxRateMode: partial.fxRateMode === 'live' ? 'live' : 'fixed',
  };
}

export function loadState(): AppState {
  const data = safeParse<Partial<AppState>>(localStorage.getItem(STORAGE_KEY));
  return {
    settings: normalizeSettings(data?.settings),
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
    settings: normalizeSettings(data.settings),
    transactions: normalizeTransactions(data.transactions),
    categories: Array.isArray(data.categories)
      ? (data.categories as Category[])
      : DEFAULT_CATEGORIES,
    wallets: data.wallets != null ? normalizeWallets(data.wallets) : [...DEFAULT_WALLETS],
  };
}

export function mergeSettings(partial: Partial<Settings>): Settings {
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...partial });
}

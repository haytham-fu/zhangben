import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, DEFAULT_WALLETS, STORAGE_KEY } from './defaults';
import type { AppState, Category, ForeignCurrency, MonthOpening, PantryItem, Settings, Transaction, Wallet } from '../types';
import {
  DEFAULT_FIXED_RATES,
  FOREIGN_CURRENCIES,
  isCurrency,
  isForeignCurrency,
  normalizePreferredCurrencies,
} from './currency';
import { costPerMeal, roundMoney } from './grocery';
import { ensurePigWallet, normalizeWallet } from './wallets';

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
    const legacyMonthly =
      Boolean((tx as { isMonthly?: boolean }).isMonthly) ||
      (tx.categoryId === 'membership' && Boolean(tx.note?.includes('音乐会员自动')));
    return {
      ...tx,
      currency,
      walletId: tx.walletId ?? null,
      isMonthly: legacyMonthly,
      isSpecial: Boolean(tx.isSpecial),
      isGroceryPurchase: Boolean(tx.isGroceryPurchase),
      groceryLotIds: Array.isArray(tx.groceryLotIds) ? tx.groceryLotIds.map(String) : undefined,
      pantryUseIds: Array.isArray(tx.pantryUseIds) ? tx.pantryUseIds.map(String) : undefined,
      pantryCostRmb:
        typeof tx.pantryCostRmb === 'number' && Number.isFinite(tx.pantryCostRmb)
          ? roundMoney(tx.pantryCostRmb)
          : undefined,
    };
  });
}

function normalizeWallets(list: unknown): Wallet[] {
  const out: Wallet[] = [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const w = normalizeWallet(item as Partial<Wallet>);
      if (w) out.push(w);
    }
  } else {
    out.push(...DEFAULT_WALLETS);
  }
  return ensurePigWallet(out);
}

function normalizePantryItems(list: unknown): PantryItem[] {
  if (!Array.isArray(list)) return [];
  const out: PantryItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Partial<PantryItem>;
    const id = typeof p.id === 'string' && p.id ? p.id : null;
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!id || !name) continue;
    const costRmb = typeof p.costRmb === 'number' && p.costRmb >= 0 ? roundMoney(p.costRmb) : 0;
    const mealsTotal =
      typeof p.mealsTotal === 'number' && p.mealsTotal > 0 ? Math.round(p.mealsTotal * 10) / 10 : 1;
    let mealsLeft =
      typeof p.mealsLeft === 'number' && Number.isFinite(p.mealsLeft)
        ? Math.round(Math.max(0, p.mealsLeft) * 10) / 10
        : mealsTotal;
    if (mealsLeft > mealsTotal) mealsLeft = mealsTotal;
    const cpm =
      typeof p.costPerMeal === 'number' && p.costPerMeal >= 0
        ? roundMoney(p.costPerMeal)
        : costPerMeal(costRmb, mealsTotal);
    const kind = p.kind ?? 'custom';
    out.push({
      id,
      name,
      kind:
        kind === 'veg' ||
        kind === 'meat' ||
        kind === 'egg' ||
        kind === 'staple' ||
        kind === 'fruit' ||
        kind === 'seasoning' ||
        kind === 'custom'
          ? kind
          : 'custom',
      costRmb,
      mealsTotal,
      mealsLeft,
      costPerMeal: cpm,
      boughtDate: typeof p.boughtDate === 'string' && p.boughtDate ? p.boughtDate : '',
      notes: typeof p.notes === 'string' ? p.notes : undefined,
      purchaseTxId: p.purchaseTxId ?? null,
    });
  }
  return out;
}


function normalizeMonthOpening(raw: unknown): MonthOpening | null | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.ym !== 'string' || !/^\d{4}-\d{2}$/.test(o.ym)) return undefined;
  const basicUsed = typeof o.basicUsed === 'number' ? o.basicUsed : Number(o.basicUsed);
  const specialUsed = typeof o.specialUsed === 'number' ? o.specialUsed : Number(o.specialUsed);
  if (!Number.isFinite(basicUsed) || !Number.isFinite(specialUsed)) return undefined;
  const out: MonthOpening = {
    ym: o.ym,
    basicUsed: Math.round(basicUsed * 100) / 100,
    specialUsed: Math.round(specialUsed * 100) / 100,
  };
  if (typeof o.expenseRmb === 'number') out.expenseRmb = Math.round(o.expenseRmb * 100) / 100;
  if (typeof o.incomeRmb === 'number') out.incomeRmb = Math.round(o.incomeRmb * 100) / 100;
  if (typeof o.label === 'string') out.label = o.label;
  return out;
}

/** Migrate legacy hkdRate/usdRate/liveHkdRate/liveUsdRate → fixedRates/liveRates. */
export function normalizeSettings(raw: unknown): Settings {
  const partial = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings> & {
    hkdRate?: number;
    usdRate?: number;
    liveHkdRate?: number | null;
    liveUsdRate?: number | null;
    /** @deprecated migrated to showMonthlyBudgetProgress */
    showGoldMountain?: boolean;
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
    musicMembershipHkd: _mmh,
    musicMembershipEnabled: _mme,
    showGoldMountain: _sgm,
    showMonthlyBudgetProgress: _smbp,
    monthOpening: _mo,
    ...rest
  } = partial as typeof partial & {
    musicMembershipHkd?: number;
    musicMembershipEnabled?: boolean;
  };

  const showMonthlyBudgetProgress =
    typeof partial.showMonthlyBudgetProgress === 'boolean'
      ? partial.showMonthlyBudgetProgress
      : typeof partial.showGoldMountain === 'boolean'
        ? partial.showGoldMountain
        : DEFAULT_SETTINGS.showMonthlyBudgetProgress;

  // Fresh install (empty partial) keeps DEFAULT monthOpening; existing saves
  // without the key must not inherit it (avoids double-count with old daily imports).
  const isFresh = Object.keys(partial).length === 0;
  const monthOpening = isFresh
    ? DEFAULT_SETTINGS.monthOpening
    : 'monthOpening' in partial
      ? normalizeMonthOpening((partial as { monthOpening?: unknown }).monthOpening) ?? null
      : undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    showMonthlyBudgetProgress,
    fixedRates,
    liveRates,
    liveRatesUpdatedAt:
      typeof partial.liveRatesUpdatedAt === 'string' ? partial.liveRatesUpdatedAt : null,
    preferredCurrencies: normalizePreferredCurrencies(partial.preferredCurrencies),
    fxRateMode: partial.fxRateMode === 'live' ? 'live' : 'fixed',
    settledMonths: Array.isArray(partial.settledMonths)
      ? partial.settledMonths.filter((m): m is string => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m))
      : [],
    monthOpening: monthOpening === undefined ? undefined : monthOpening,
  };
}

function normalizeCategories(list: unknown): Category[] {
  const base =
    Array.isArray(list) && list.length > 0 ? (list as Category[]) : [...DEFAULT_CATEGORIES];
  return base.map((c) => {
    if (c.id === 'membership') {
      return { ...c, name: '月度支出', icon: c.icon === '🎵' ? '📅' : c.icon || '📅' };
    }
    if (c.id === 'groceries') {
      return { ...c, name: '买菜支出', icon: c.icon || '🥬' };
    }
    return c;
  });
}

export function loadState(): AppState {
  const data = safeParse<Partial<AppState>>(localStorage.getItem(STORAGE_KEY));
  return {
    settings: normalizeSettings(data?.settings),
    transactions: normalizeTransactions(data?.transactions),
    categories: normalizeCategories(data?.categories),
    wallets: data?.wallets != null ? normalizeWallets(data.wallets) : [...DEFAULT_WALLETS],
    pantryItems: normalizePantryItems(data?.pantryItems),
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
    categories: normalizeCategories(data.categories),
    wallets: data.wallets != null ? normalizeWallets(data.wallets) : [...DEFAULT_WALLETS],
    pantryItems: normalizePantryItems(data.pantryItems),
  };
}

export function mergeSettings(partial: Partial<Settings>): Settings {
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...partial });
}

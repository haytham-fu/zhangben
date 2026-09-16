import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { v4 as uuid } from 'uuid';
import type {
  AppState,
  Currency,
  SatMode,
  Settings,
  Transaction,
  TxKind,
  TxType,
  PaymentMethod,
  Bucket,
  Wallet,
} from '../types';
import { getRate, toRmb, toRmbWithRate } from '../utils/currency';
import { loadState, saveState } from '../utils/storage';
import { monthKey } from '../utils/budget';
import { createWallet } from '../utils/wallets';

export interface AddTxInput {
  type: TxType;
  kind?: TxKind;
  date: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  bucket: Bucket;
  note?: string;
  isSpecial?: boolean;
  isMonthly?: boolean;
  paymentMethod?: PaymentMethod;
  /** Override conversion rate (e.g. live FX); otherwise settings rate */
  rate?: number;
  walletId?: string | null;
}

export function useStore() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...partial } }));
  }, []);

  const setSatModeForDate = useCallback((dateStr: string, mode: SatMode) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        satModeOverrides: { ...s.settings.satModeOverrides, [dateStr]: mode },
      },
    }));
  }, []);

  const addTransaction = useCallback((input: AddTxInput) => {
    setState((s) => {
      const rate = input.rate ?? getRate(input.currency, s.settings);
      const amountRmb =
        input.rate != null
          ? toRmbWithRate(input.amount, input.rate)
          : toRmb(input.amount, input.currency, s.settings);
      const tx: Transaction = {
        id: uuid(),
        type: input.type,
        kind: input.kind ?? 'normal',
        date: input.date,
        amount: input.amount,
        currency: input.currency,
        rate,
        amountRmb,
        categoryId: input.categoryId,
        bucket: input.bucket,
        note: input.note ?? '',
        isSpecial: input.isSpecial ?? false,
        isMonthly: input.isMonthly ?? false,
        paymentMethod: input.paymentMethod ?? 'none',
        walletId: input.walletId ?? null,
        createdAt: new Date().toISOString(),
      };
      return { ...s, transactions: [tx, ...s.transactions] };
    });
  }, []);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        if (patch.amount != null || patch.currency != null || patch.rate != null) {
          const currency = patch.currency ?? t.currency;
          const amount = patch.amount ?? t.amount;
          const rate = patch.rate ?? getRate(currency, s.settings);
          next.rate = rate;
          next.amountRmb = toRmbWithRate(amount, rate);
        }
        return next;
      }),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      transactions: s.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const addWallet = useCallback((allocated = 0) => {
    setState((s) => {
      const wallet = createWallet(s.wallets, allocated);
      return { ...s, wallets: [...s.wallets, wallet] };
    });
  }, []);

  const updateWallet = useCallback((id: string, patch: Partial<Pick<Wallet, 'name' | 'color' | 'allocated'>>) => {
    setState((s) => ({
      ...s,
      wallets: s.wallets.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch };
        if (patch.allocated != null) {
          next.allocated = Math.max(0, Math.round(patch.allocated * 100) / 100);
        }
        if (patch.name != null) {
          next.name = patch.name.trim() || w.name;
        }
        return next;
      }),
    }));
  }, []);

  const removeWallet = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      wallets: s.wallets.filter((w) => w.id !== id),
      transactions: s.transactions.map((t) =>
        t.walletId === id ? { ...t, walletId: null } : t,
      ),
    }));
  }, []);


  const replaceState = useCallback((next: AppState) => setState(next), []);

  const resetAll = useCallback(() => {
    localStorage.removeItem('zhangben-v1');
    setState(loadState());
  }, []);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const currentYm = monthKey(new Date());

  const categoryMap = useMemo(() => {
    const m = new Map(state.categories.map((c) => [c.id, c]));
    return m;
  }, [state.categories]);

  const walletMap = useMemo(() => {
    const m = new Map(state.wallets.map((w) => [w.id, w]));
    return m;
  }, [state.wallets]);

  return {
    state,
    settings: state.settings,
    transactions: state.transactions,
    categories: state.categories,
    wallets: state.wallets,
    categoryMap,
    walletMap,
    todayStr,
    currentYm,
    updateSettings,
    setSatModeForDate,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addWallet,
    updateWallet,
    removeWallet,
    replaceState,
    resetAll,
  };
}

export type Store = ReturnType<typeof useStore>;

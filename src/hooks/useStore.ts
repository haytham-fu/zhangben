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
} from '../types';
import { getRate, toRmb } from '../utils/currency';
import { loadState, saveState } from '../utils/storage';
import { monthKey } from '../utils/budget';

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
  paymentMethod?: PaymentMethod;
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
      const rate = getRate(input.currency, s.settings);
      const amountRmb = toRmb(input.amount, input.currency, s.settings);
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
        paymentMethod: input.paymentMethod ?? 'none',
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
        if (patch.amount != null || patch.currency != null) {
          const currency = patch.currency ?? t.currency;
          const amount = patch.amount ?? t.amount;
          next.rate = getRate(currency, s.settings);
          next.amountRmb = toRmb(amount, currency, s.settings);
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

  const ensureMusicMembership = useCallback((ym?: string) => {
    setState((s) => {
      if (!s.settings.musicMembershipEnabled) return s;
      const key = ym ?? monthKey(new Date());
      const already = s.transactions.some(
        (t) =>
          t.categoryId === 'membership' &&
          t.date.startsWith(key) &&
          t.note.includes('音乐会员自动'),
      );
      if (already) return s;
      const amount = s.settings.musicMembershipHkd;
      const rate = s.settings.hkdRate;
      const amountRmb = Math.round(amount * rate * 100) / 100;
      const tx: Transaction = {
        id: uuid(),
        type: 'expense',
        kind: 'normal',
        date: `${key}-01`,
        amount,
        currency: 'HKD',
        rate,
        amountRmb,
        categoryId: 'membership',
        bucket: 'special',
        note: '音乐会员自动·月初',
        isSpecial: false,
        paymentMethod: 'none',
        createdAt: new Date().toISOString(),
      };
      return { ...s, transactions: [tx, ...s.transactions] };
    });
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

  return {
    state,
    settings: state.settings,
    transactions: state.transactions,
    categories: state.categories,
    categoryMap,
    todayStr,
    currentYm,
    updateSettings,
    setSatModeForDate,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    ensureMusicMembership,
    replaceState,
    resetAll,
  };
}

export type Store = ReturnType<typeof useStore>;

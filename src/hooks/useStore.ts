import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { v4 as uuid } from 'uuid';
import type {
  AppState,
  Currency,
  GroceryKind,
  PantryItem,
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
import { costPerMeal, roundMoney } from '../utils/grocery';
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
  isGroceryPurchase?: boolean;
  groceryLotIds?: string[];
  pantryUseIds?: string[];
  pantryCostRmb?: number;
}

export interface GroceryItemInput {
  name: string;
  kind: GroceryKind;
  /** 我实际出的钱（已含 AA 后的净额） */
  costRmb: number;
  meals: number;
  notes?: string;
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
        isGroceryPurchase: input.isGroceryPurchase,
        groceryLotIds: input.groceryLotIds,
        pantryUseIds: input.pantryUseIds,
        pantryCostRmb: input.pantryCostRmb,
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

  /** 买菜支出：记一笔流水 + 写入库存 */
  const addGroceryPurchase = useCallback(
    (opts: {
      date: string;
      items: GroceryItemInput[];
      paymentMethod: PaymentMethod;
      note?: string;
      walletId?: string | null;
    }) => {
      setState((s) => {
        const txId = uuid();
        const lotIds: string[] = [];
        const pantry: PantryItem[] = opts.items.map((it) => {
          const id = uuid();
          lotIds.push(id);
          const meals = Math.max(0.1, it.meals);
          const cost = roundMoney(Math.max(0, it.costRmb));
          return {
            id,
            name: it.name.trim() || '食材',
            kind: it.kind,
            costRmb: cost,
            mealsTotal: meals,
            mealsLeft: meals,
            costPerMeal: costPerMeal(cost, meals),
            boughtDate: opts.date,
            notes: it.notes,
            purchaseTxId: txId,
          };
        });
        const total = roundMoney(pantry.reduce((sum, p) => sum + p.costRmb, 0));
        const names = pantry.map((p) => p.name).join('、');
        const tx: Transaction = {
          id: txId,
          type: 'expense',
          kind: 'normal',
          date: opts.date,
          amount: total,
          currency: 'RMB',
          rate: 1,
          amountRmb: total,
          categoryId: 'groceries',
          bucket: 'basic',
          note: opts.note?.trim() || `买菜：${names}`,
          isSpecial: false,
          isMonthly: false,
          paymentMethod: opts.paymentMethod,
          walletId: opts.walletId ?? null,
          createdAt: new Date().toISOString(),
          isGroceryPurchase: true,
          groceryLotIds: lotIds,
        };
        return {
          ...s,
          transactions: [tx, ...s.transactions],
          pantryItems: [...pantry, ...s.pantryItems],
        };
      });
    },
    [],
  );

  /** 用库存做一顿：扣减顿数并记吃饭支出 */
  const cookFromPantry = useCallback(
    (opts: {
      date: string;
      pantryIds: string[];
      paymentMethod?: PaymentMethod;
      note?: string;
      walletId?: string | null;
      /** 额外现金（外卖等），默认 0 */
      extraRmb?: number;
    }) => {
      setState((s) => {
        const selected = s.pantryItems.filter((p) => opts.pantryIds.includes(p.id) && p.mealsLeft > 0);
        if (selected.length === 0 && !(opts.extraRmb && opts.extraRmb > 0)) return s;
        const pantryCost = roundMoney(selected.reduce((sum, p) => sum + p.costPerMeal, 0));
        const extra = roundMoney(Math.max(0, opts.extraRmb ?? 0));
        const total = roundMoney(pantryCost + extra);
        const names = selected.map((p) => p.name).join('、');
        const idSet = new Set(opts.pantryIds);
        const nextPantry = s.pantryItems.map((p) => {
          if (!idSet.has(p.id) || p.mealsLeft <= 0) return p;
          const left = Math.round(Math.max(0, p.mealsLeft - 1) * 10) / 10;
          return { ...p, mealsLeft: left };
        });
        const tx: Transaction = {
          id: uuid(),
          type: 'expense',
          kind: 'normal',
          date: opts.date,
          amount: total,
          currency: 'RMB',
          rate: 1,
          amountRmb: total,
          categoryId: 'food',
          bucket: 'basic',
          note: opts.note?.trim() || (names ? `做饭：${names}` : '做饭'),
          isSpecial: false,
          isMonthly: false,
          paymentMethod: opts.paymentMethod ?? 'other',
          walletId: opts.walletId ?? null,
          createdAt: new Date().toISOString(),
          pantryUseIds: selected.map((p) => p.id),
          pantryCostRmb: pantryCost,
        };
        return {
          ...s,
          transactions: [tx, ...s.transactions],
          pantryItems: nextPantry,
        };
      });
    },
    [],
  );

  const removePantryItem = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      pantryItems: s.pantryItems.filter((p) => p.id !== id),
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
    pantryItems: state.pantryItems,
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
    addGroceryPurchase,
    cookFromPantry,
    removePantryItem,
    replaceState,
    resetAll,
  };
}

export type Store = ReturnType<typeof useStore>;

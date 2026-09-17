import { useCallback, useEffect, useMemo, useState } from 'react';
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
  WalletTransferSource,
} from '../types';
import { getRate, toRmb, toRmbWithRate } from '../utils/currency';
import { costPerMeal, roundMoney } from '../utils/grocery';
import { loadState, saveState } from '../utils/storage';
import { STORAGE_KEY } from '../utils/defaults';
import { monthBasicUsed, monthSpecialUsed, dayNetBasic, getDailyPlanAmount } from '../utils/budget';
import { localDateStr, localMonthKey, normalizeTxDate } from '../utils/dates';
import { mergeProfileSettings, type LedgerProfilePack } from '../utils/profile';
import {
  applyTransferToWallet,
  createWallet,
  decreaseWalletForSpend,
  ensurePigWallet,
  increaseWalletForRefund,
  isMonthSettled,
  isPigWallet,
  PIG_WALLET_ID,
  settlementDelta,
  sourceAvail,
} from '../utils/wallets';

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

function mapWalletsSpend(wallets: Wallet[], walletId: string | null | undefined, amountRmb: number): Wallet[] {
  if (!walletId || amountRmb <= 0) return wallets;
  return wallets.map((w) => (w.id === walletId ? decreaseWalletForSpend(w, amountRmb) : w));
}

function mapWalletsRefund(wallets: Wallet[], walletId: string | null | undefined, amountRmb: number): Wallet[] {
  if (!walletId || amountRmb <= 0) return wallets;
  return wallets.map((w) => (w.id === walletId ? increaseWalletForRefund(w, amountRmb) : w));
}

export function useStore() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Always keep 小钱猪 present
  useEffect(() => {
    setState((s) => {
      const next = ensurePigWallet(s.wallets);
      if (next === s.wallets || (next.length === s.wallets.length && next.every((w, i) => w === s.wallets[i]))) {
        return s;
      }
      // Only rewrite if pig missing or id remapped
      const same =
        s.wallets.some((w) => isPigWallet(w)) &&
        s.wallets.find((w) => isPigWallet(w))?.id === PIG_WALLET_ID;
      if (same && next.length === s.wallets.length) return s;
      return { ...s, wallets: next };
    });
  }, []);

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
        date: normalizeTxDate(input.date),
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
      let wallets = s.wallets;
      if (tx.type === 'expense' && tx.kind !== 'topup' && tx.walletId) {
        wallets = mapWalletsSpend(wallets, tx.walletId, tx.amountRmb);
      }
      return { ...s, transactions: [tx, ...s.transactions], wallets };
    });
  }, []);

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState((s) => {
      const prev = s.transactions.find((t) => t.id === id);
      if (!prev) return s;
      const nextTx = { ...prev, ...patch };
      if (patch.date != null) nextTx.date = normalizeTxDate(patch.date);
      if (patch.amount != null || patch.currency != null || patch.rate != null) {
        const currency = patch.currency ?? prev.currency;
        const amount = patch.amount ?? prev.amount;
        const rate = patch.rate ?? getRate(currency, s.settings);
        nextTx.rate = rate;
        nextTx.amountRmb = toRmbWithRate(amount, rate);
      }
      let wallets = s.wallets;
      const wasSpend =
        prev.type === 'expense' && prev.kind !== 'topup' && prev.walletId;
      const isSpend =
        nextTx.type === 'expense' && nextTx.kind !== 'topup' && nextTx.walletId;
      if (wasSpend) {
        wallets = mapWalletsRefund(wallets, prev.walletId, prev.amountRmb);
      }
      if (isSpend) {
        wallets = mapWalletsSpend(wallets, nextTx.walletId, nextTx.amountRmb);
      }
      return {
        ...s,
        transactions: s.transactions.map((t) => (t.id === id ? nextTx : t)),
        wallets,
      };
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState((s) => {
      const prev = s.transactions.find((t) => t.id === id);
      let wallets = s.wallets;
      if (prev && prev.type === 'expense' && prev.kind !== 'topup' && prev.walletId) {
        wallets = mapWalletsRefund(wallets, prev.walletId, prev.amountRmb);
      }
      return {
        ...s,
        transactions: s.transactions.filter((t) => t.id !== id),
        wallets,
      };
    });
  }, []);

  const addWallet = useCallback((opts?: { name?: string; color?: string }) => {
    setState((s) => {
      const wallets = ensurePigWallet(s.wallets);
      const wallet = createWallet(wallets, opts);
      return { ...s, wallets: [...wallets, wallet] };
    });
  }, []);

  const updateWallet = useCallback(
    (id: string, patch: Partial<Pick<Wallet, 'name' | 'color' | 'target'>>) => {
      setState((s) => ({
        ...s,
        wallets: s.wallets.map((w) => {
          if (w.id !== id) return w;
          if (isPigWallet(w)) {
            // 小钱猪: allow color/target only; name fixed
            const next = { ...w };
            if (patch.color != null && /^#[0-9A-Fa-f]{6}$/.test(patch.color)) {
              next.color = patch.color;
            }
            if (patch.target !== undefined) {
              next.target =
                patch.target != null && patch.target > 0
                  ? roundMoney(patch.target)
                  : null;
            }
            return next;
          }
          const next = { ...w, ...patch };
          if (patch.name != null) {
            next.name = patch.name.trim() || w.name;
          }
          if (patch.target !== undefined) {
            next.target =
              patch.target != null && patch.target > 0 ? roundMoney(patch.target) : null;
          }
          return next;
        }),
      }));
    },
    [],
  );

  const removeWallet = useCallback((id: string) => {
    setState((s) => {
      const target = s.wallets.find((w) => w.id === id);
      if (!target || isPigWallet(target)) return s; // cannot delete 小钱猪
      return {
        ...s,
        wallets: s.wallets.filter((w) => w.id !== id),
        transactions: s.transactions.map((t) =>
          t.walletId === id ? { ...t, walletId: null } : t,
        ),
      };
    });
  }, []);

  /**
   * 转入 / 转出 小荷包.
   * direction 'in': from 本月总预算剩余 (or basic/special) into jar.
   * direction 'out': from jar back to pool.
   */
  const transferWallet = useCallback(
    (
      walletId: string,
      direction: 'in' | 'out',
      amount: number,
      source: WalletTransferSource = 'total',
    ): { ok: boolean; message?: string } => {
      const amt = roundMoney(Math.abs(amount));
      if (!(amt > 0)) return { ok: false, message: '请输入有效金额' };

      let result: { ok: boolean; message?: string } = { ok: false, message: '未找到小荷包' };
      setState((s) => {
        const ym = localMonthKey();
        const wallets = ensurePigWallet(s.wallets);
        const idx = wallets.findIndex((w) => w.id === walletId);
        if (idx < 0) {
          result = { ok: false, message: '未找到小荷包' };
          return s;
        }
        const w = wallets[idx];
        if (isPigWallet(w)) {
          result = { ok: false, message: '小钱猪请用「月末结算」，不支持手动转入转出' };
          return s;
        }
        if (direction === 'in') {
          const avail = sourceAvail(source, s.settings, wallets, s.transactions, ym);
          if (amt > avail + 1e-9) {
            result = {
              ok: false,
              message: `可转余额不足（当前可转 ¥${avail.toFixed(2)}）`,
            };
            return s;
          }
        } else {
          if (amt > w.balance + 1e-9) {
            result = {
              ok: false,
              message: `小荷包余额不足（已存 ¥${w.balance.toFixed(2)}）`,
            };
            return s;
          }
        }
        const note =
          direction === 'in'
            ? source === 'basic'
              ? '从基础剩余转入'
              : source === 'special'
                ? '从专项剩余转入'
                : '从本月总预算剩余转入'
            : '转出至本月预算池';
        const next = [...wallets];
        next[idx] = applyTransferToWallet(w, direction, amt, source, note, ym);
        result = { ok: true };
        return { ...s, wallets: next };
      });
      return result;
    },
    [],
  );

  /**
   * 月末结算：本月可转余额（盈余）→ 小钱猪；超支（负可转）从小钱猪扣除（可为负=欠小钱猪）。
   */
  const settleMonth = useCallback((ym: string): { ok: boolean; message: string; delta?: number } => {
    let result = { ok: false, message: '结算失败', delta: 0 };
    setState((s) => {
      if (isMonthSettled(s.settings, ym)) {
        result = { ok: false, message: `${ym} 已结算过`, delta: 0 };
        return s;
      }
      const wallets = ensurePigWallet(s.wallets);
      const delta = settlementDelta(s.settings, wallets, s.transactions, ym);
      const pigIdx = wallets.findIndex((w) => isPigWallet(w));
      if (pigIdx < 0) {
        result = { ok: false, message: '未找到小钱猪', delta: 0 };
        return s;
      }
      const pig = wallets[pigIdx];
      let nextPig = pig;
      if (delta > 0) {
        nextPig = applyTransferToWallet(
          pig,
          'in',
          delta,
          'settle',
          `${ym} 月末盈余转入`,
          ym,
        );
      } else if (delta < 0) {
        nextPig = applyTransferToWallet(
          pig,
          'out',
          Math.abs(delta),
          'settle',
          `${ym} 月末超支扣除`,
          ym,
        );
      } else {
        // zero: still mark settled, no balance change
        nextPig = pig;
      }
      const nextWallets = [...wallets];
      nextWallets[pigIdx] = nextPig;
      const settled = [...(s.settings.settledMonths ?? []), ym];
      result = {
        ok: true,
        message:
          delta > 0
            ? `已将盈余 ¥${delta.toFixed(2)} 转入小钱猪`
            : delta < 0
              ? `已从超支 ¥${Math.abs(delta).toFixed(2)} 扣除（余额可为负表示欠小钱猪）`
              : '本月刚好花完，已标记结算',
        delta,
      };
      return {
        ...s,
        wallets: nextWallets,
        settings: { ...s.settings, settledMonths: settled },
      };
    });
    return result;
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
            boughtDate: normalizeTxDate(opts.date),
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
          date: normalizeTxDate(opts.date),
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
        let wallets = s.wallets;
        if (tx.walletId) {
          wallets = mapWalletsSpend(wallets, tx.walletId, tx.amountRmb);
        }
        return {
          ...s,
          transactions: [tx, ...s.transactions],
          pantryItems: [...pantry, ...s.pantryItems],
          wallets,
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
          date: normalizeTxDate(opts.date),
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
        let wallets = s.wallets;
        if (tx.walletId) {
          wallets = mapWalletsSpend(wallets, tx.walletId, tx.amountRmb);
        }
        return {
          ...s,
          transactions: [tx, ...s.transactions],
          pantryItems: nextPantry,
          wallets,
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

  const replaceState = useCallback((next: AppState) => {
    setState({
      ...next,
      wallets: ensurePigWallet(next.wallets ?? []),
      settings: {
        ...next.settings,
        settledMonths: next.settings.settledMonths ?? [],
      },
    });
  }, []);

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('zhangben-v1'); // legacy key from pre-v2 blank ledger
    setState(loadState());
  }, []);

  const todayStr = localDateStr();
  const currentYm = localMonthKey();

  const categoryMap = useMemo(() => {
    const m = new Map(state.categories.map((c) => [c.id, c]));
    return m;
  }, [state.categories]);

  const walletMap = useMemo(() => {
    const m = new Map(state.wallets.map((w) => [w.id, w]));
    return m;
  }, [state.wallets]);

  /** Single reactive snapshot — all overview/calendar consumers must use this. */
  const monthStats = useMemo(() => {
    const opts = { includeSpecial: state.settings.includeSpecialInAdvice };
    const basicUsed = monthBasicUsed(state.transactions, state.settings, currentYm, opts);
    const specialUsed = monthSpecialUsed(state.transactions, state.settings, currentYm, opts);
    const totalBudget = state.settings.basicBudget + state.settings.specialBudget;
    const totalUsed = Math.round((basicUsed + specialUsed) * 100) / 100;
    const todayUsed = dayNetBasic(state.transactions, todayStr, opts);
    const todayPlan = getDailyPlanAmount(todayStr, state.settings);
    return {
      basicUsed,
      specialUsed,
      totalUsed,
      totalBudget,
      basicRemain: Math.round((state.settings.basicBudget - basicUsed) * 100) / 100,
      specialRemain: Math.round((state.settings.specialBudget - specialUsed) * 100) / 100,
      totalRemain: Math.round((totalBudget - totalUsed) * 100) / 100,
      todayUsed,
      todayPlan,
      todayRemain: Math.round((todayPlan - todayUsed) * 100) / 100,
      txCount: state.transactions.length,
    };
  }, [state.transactions, state.settings, currentYm, todayStr]);

  const applyProfilePack = useCallback((pack: LedgerProfilePack) => {
    setState((s) => ({
      ...s,
      settings: mergeProfileSettings(s.settings, pack),
    }));
  }, []);

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
    monthStats,
    updateSettings,
    setSatModeForDate,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addWallet,
    updateWallet,
    removeWallet,
    transferWallet,
    settleMonth,
    addGroceryPurchase,
    cookFromPantry,
    removePantryItem,
    replaceState,
    applyProfilePack,
    resetAll,
  };
}

export type Store = ReturnType<typeof useStore>;

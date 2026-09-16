import { v4 as uuid } from 'uuid';
import type {
  Bucket,
  Settings,
  Transaction,
  Wallet,
  WalletBucket,
  WalletTransfer,
  WalletTransferSource,
} from '../types';
import { filterMonth, isBudgetExpense, netBasicSpend, specialSpend } from './budget';
import { roundMoney } from './grocery';

export const WALLET_COLORS = [
  '#3B82F6',
  '#60A5FA',
  '#818CF8',
  '#A78BFA',
  '#F472B6',
  '#FB923C',
  '#FBBF24',
  '#34D399',
  '#22D3EE',
  '#4ADE80',
] as const;

export const CUTE_WALLET_NAMES = [
  '花瓣荷包',
  '星星罐',
  '云朵袋',
  '小鱼钱包',
  '奶茶基金',
  '泡泡罐',
  '月亮匣',
  '彩虹袋',
  '小猫储蓄',
  '蓝莓罐',
  '棉花糖',
  '元气匣',
  '阳光袋',
  '薄荷罐',
  '软糖匣',
  '海豚罐',
  '草莓袋',
  '汽水匣',
] as const;

/** Fixed id for the system 「小钱猪」 jar */
export const PIG_WALLET_ID = 'system-pig';
export const PIG_WALLET_NAME = '小钱猪';
export const PIG_WALLET_COLOR = '#F472B6';

export function isPigWallet(w: Wallet | null | undefined): boolean {
  return Boolean(w && (w.systemKey === 'pig' || w.id === PIG_WALLET_ID));
}

export function createPigWallet(): Wallet {
  return {
    id: PIG_WALLET_ID,
    name: PIG_WALLET_NAME,
    color: PIG_WALLET_COLOR,
    bucket: 'custom',
    balance: 0,
    target: null,
    transfers: [],
    systemKey: 'pig',
    createdAt: '2020-01-01T00:00:00.000Z',
  };
}

/** Ensure 「小钱猪」 exists; merge legacy pig-named wallets if needed. */
export function ensurePigWallet(wallets: Wallet[]): Wallet[] {
  const pigIdx = wallets.findIndex((w) => isPigWallet(w));
  if (pigIdx >= 0) {
    const pig = wallets[pigIdx];
    const fixed: Wallet = {
      ...pig,
      id: PIG_WALLET_ID,
      name: PIG_WALLET_NAME,
      systemKey: 'pig',
      color: pig.color || PIG_WALLET_COLOR,
      bucket: 'custom',
    };
    const rest = wallets.filter((_, i) => i !== pigIdx);
    // Remap any duplicate system pigs
    const cleaned = rest.filter((w) => !isPigWallet(w) && w.id !== PIG_WALLET_ID);
    return [fixed, ...cleaned];
  }
  return [createPigWallet(), ...wallets];
}

export function pickCuteName(existing: Wallet[]): string {
  const used = new Set(existing.map((w) => w.name));
  used.add(PIG_WALLET_NAME);
  for (const n of CUTE_WALLET_NAMES) {
    if (!used.has(n)) return n;
  }
  return `小荷包${existing.length + 1}`;
}

export function pickWalletColor(existing: Wallet[]): string {
  const usedCounts = new Map<string, number>();
  for (const c of WALLET_COLORS) usedCounts.set(c, 0);
  for (const w of existing) {
    usedCounts.set(w.color, (usedCounts.get(w.color) ?? 0) + 1);
  }
  let best: string = WALLET_COLORS[0];
  let bestCount = Infinity;
  for (const c of WALLET_COLORS) {
    const n = usedCounts.get(c) ?? 0;
    if (n < bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

export interface CreateWalletOpts {
  name?: string;
  color?: string;
  bucket?: WalletBucket | null;
}

/** Create a user 小荷包: name + color only; balance starts at 0. */
export function createWallet(existing: Wallet[], opts: CreateWalletOpts = {}): Wallet {
  const name = (opts.name?.trim() || pickCuteName(existing)).trim() || pickCuteName(existing);
  const color =
    opts.color && /^#[0-9A-Fa-f]{6}$/.test(opts.color) ? opts.color : pickWalletColor(existing);
  return {
    id: uuid(),
    name,
    color,
    bucket: opts.bucket ?? 'custom',
    balance: 0,
    target: null,
    transfers: [],
    systemKey: null,
    createdAt: new Date().toISOString(),
  };
}

export function walletSpend(
  txs: Transaction[],
  walletId: string,
  ym: string,
  opts?: { includeSpecial?: boolean },
): number {
  const includeSpecial = opts?.includeSpecial ?? true;
  let sum = 0;
  for (const t of filterMonth(txs, ym)) {
    if (t.walletId !== walletId) continue;
    if (!includeSpecial && t.isSpecial) continue;
    if (isBudgetExpense(t)) sum += t.amountRmb;
  }
  return roundMoney(sum);
}

/** Sum of balances in all 小荷包 (including 小钱猪). */
export function totalWalletBalance(wallets: Wallet[]): number {
  return roundMoney(wallets.reduce((s, w) => s + w.balance, 0));
}

/** User jars only (exclude 小钱猪) for transferable parking. */
export function totalUserWalletBalance(wallets: Wallet[]): number {
  return roundMoney(wallets.filter((w) => !isPigWallet(w)).reduce((s, w) => s + w.balance, 0));
}

export function monthNetSpend(
  txs: Transaction[],
  ym: string,
  settings: Settings,
): { basicUsed: number; specialUsed: number; totalUsed: number; totalBudget: number; remain: number } {
  const monthTxs = filterMonth(txs, ym);
  const basicUsed = netBasicSpend(monthTxs, { includeSpecial: settings.includeSpecialInAdvice });
  const specialUsed = specialSpend(monthTxs, { includeSpecial: true });
  const totalUsed = roundMoney(basicUsed + specialUsed);
  const totalBudget = roundMoney(settings.basicBudget + settings.specialBudget);
  const remain = roundMoney(totalBudget - totalUsed);
  return { basicUsed, specialUsed, totalUsed, totalBudget, remain };
}

/**
 * 可转余额：本月总预算剩余 − 用户小荷包已存（不含小钱猪）。
 * 转入小荷包会占用可转余额；小钱猪由月末结算单独处理。
 */
export function transferableRemain(
  settings: Settings,
  wallets: Wallet[],
  txs: Transaction[],
  ym: string,
): number {
  const { remain } = monthNetSpend(txs, ym, settings);
  return roundMoney(remain - totalUserWalletBalance(wallets));
}

export function bucketRemain(
  settings: Settings,
  txs: Transaction[],
  ym: string,
  bucket: Bucket,
): number {
  const monthTxs = filterMonth(txs, ym);
  if (bucket === 'basic') {
    const used = netBasicSpend(monthTxs, { includeSpecial: settings.includeSpecialInAdvice });
    return roundMoney(settings.basicBudget - used);
  }
  const used = specialSpend(monthTxs, { includeSpecial: true });
  return roundMoney(settings.specialBudget - used);
}

export function sourceAvail(
  source: WalletTransferSource,
  settings: Settings,
  wallets: Wallet[],
  txs: Transaction[],
  ym: string,
): number {
  if (source === 'basic') return Math.max(0, bucketRemain(settings, txs, ym, 'basic'));
  if (source === 'special') return Math.max(0, bucketRemain(settings, txs, ym, 'special'));
  if (source === 'settle') return 0;
  return Math.max(0, transferableRemain(settings, wallets, txs, ym));
}

export function makeTransfer(
  direction: 'in' | 'out',
  amount: number,
  source?: WalletTransferSource,
  note?: string,
  ym?: string,
): WalletTransfer {
  return {
    id: uuid(),
    direction,
    amount: roundMoney(Math.abs(amount)),
    source,
    ym,
    note,
    createdAt: new Date().toISOString(),
  };
}

export function applyTransferToWallet(
  wallet: Wallet,
  direction: 'in' | 'out',
  amount: number,
  source?: WalletTransferSource,
  note?: string,
  ym?: string,
): Wallet {
  const amt = roundMoney(Math.abs(amount));
  if (amt <= 0) return wallet;
  const delta = direction === 'in' ? amt : -amt;
  const nextBalance = roundMoney(wallet.balance + delta);
  // User jars: don't go below 0 on 转出; 小钱猪 may go negative (欠小钱猪)
  const balance = isPigWallet(wallet) ? nextBalance : Math.max(0, nextBalance);
  const transfer = makeTransfer(direction, amt, source, note, ym);
  return {
    ...wallet,
    balance,
    transfers: [transfer, ...(wallet.transfers ?? [])].slice(0, 100),
  };
}

/** Decrease jar balance when spending from it (user jars clamp at 0). */
export function decreaseWalletForSpend(wallet: Wallet, amountRmb: number): Wallet {
  const amt = roundMoney(Math.abs(amountRmb));
  if (amt <= 0) return wallet;
  if (isPigWallet(wallet)) {
    return { ...wallet, balance: roundMoney(wallet.balance - amt) };
  }
  return { ...wallet, balance: Math.max(0, roundMoney(wallet.balance - amt)) };
}

export function increaseWalletForRefund(wallet: Wallet, amountRmb: number): Wallet {
  const amt = roundMoney(Math.abs(amountRmb));
  if (amt <= 0) return wallet;
  return { ...wallet, balance: roundMoney(wallet.balance + amt) };
}

export function normalizeWalletBucket(raw: unknown): WalletBucket | null {
  if (raw === 'special' || raw === 'basic' || raw === 'custom') return raw;
  if (raw == null) return 'custom';
  return 'custom';
}

function normalizeTransfers(raw: unknown): WalletTransfer[] {
  if (!Array.isArray(raw)) return [];
  const out: WalletTransfer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Partial<WalletTransfer>;
    const direction = t.direction === 'out' ? 'out' : t.direction === 'in' ? 'in' : null;
    if (!direction) continue;
    const amount =
      typeof t.amount === 'number' && Number.isFinite(t.amount) ? roundMoney(Math.abs(t.amount)) : 0;
    if (amount <= 0) continue;
    out.push({
      id: typeof t.id === 'string' && t.id ? t.id : uuid(),
      direction,
      amount,
      source:
        t.source === 'total' ||
        t.source === 'basic' ||
        t.source === 'special' ||
        t.source === 'settle'
          ? t.source
          : undefined,
      ym: typeof t.ym === 'string' ? t.ym : undefined,
      note: typeof t.note === 'string' ? t.note : undefined,
      createdAt:
        typeof t.createdAt === 'string' && t.createdAt ? t.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

export function normalizeWallet(raw: Partial<Wallet> & { id?: string; allocated?: number }): Wallet | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uuid();
  const systemKey = raw.systemKey === 'pig' || id === PIG_WALLET_ID ? 'pig' : null;
  const name =
    systemKey === 'pig'
      ? PIG_WALLET_NAME
      : typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : '小荷包';
  const color =
    typeof raw.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.color)
      ? raw.color
      : systemKey === 'pig'
        ? PIG_WALLET_COLOR
        : WALLET_COLORS[0];
  const bucket = systemKey === 'pig' ? 'custom' : normalizeWalletBucket(raw.bucket);
  // Migrate: legacy allocated → balance
  let balance = 0;
  if (typeof raw.balance === 'number' && Number.isFinite(raw.balance)) {
    balance = roundMoney(raw.balance);
  } else if (typeof raw.allocated === 'number' && Number.isFinite(raw.allocated)) {
    balance = roundMoney(Math.max(0, raw.allocated));
  }
  // 小钱猪 may be negative (欠); user jars migrate non-negative
  if (systemKey !== 'pig') balance = Math.max(0, balance);

  const target =
    typeof raw.target === 'number' && Number.isFinite(raw.target) && raw.target > 0
      ? roundMoney(raw.target)
      : null;
  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString();
  const transfers = normalizeTransfers(raw.transfers);

  return {
    id: systemKey === 'pig' ? PIG_WALLET_ID : id,
    name,
    color,
    bucket,
    balance,
    target,
    transfers,
    systemKey,
    createdAt: systemKey === 'pig' ? '2020-01-01T00:00:00.000Z' : createdAt,
  };
}

export function settledMonthsOf(settings: Settings): string[] {
  return Array.isArray(settings.settledMonths) ? settings.settledMonths : [];
}

export function isMonthSettled(settings: Settings, ym: string): boolean {
  return settledMonthsOf(settings).includes(ym);
}

/**
 * Month-end settlement amount into 小钱猪:
 * surplus (remain > 0 after user jars) → transfer in;
 * deficit (remain < 0) → deduct (balance may go negative = 欠小钱猪).
 *
 * Uses: 本月总预算剩余 − 用户小荷包已存 = transferableRemain
 * (same figure as 可转余额; settlement parks leftover / covers overspend).
 */
export function settlementDelta(
  settings: Settings,
  wallets: Wallet[],
  txs: Transaction[],
  ym: string,
): number {
  return transferableRemain(settings, wallets, txs, ym);
}

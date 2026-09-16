import { v4 as uuid } from 'uuid';
import type { Bucket, Settings, Transaction, Wallet } from '../types';
import { budgetStatus, filterMonth, isBudgetExpense, type BudgetStatus } from './budget';

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

export function pickCuteName(existing: Wallet[]): string {
  const used = new Set(existing.map((w) => w.name));
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

export function createWallet(bucket: Bucket, existing: Wallet[], allocated = 0): Wallet {
  return {
    id: uuid(),
    name: pickCuteName(existing),
    color: pickWalletColor(existing),
    bucket,
    allocated: Math.max(0, Math.round(allocated * 100) / 100),
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
  return Math.round(sum * 100) / 100;
}

export function allocatedSum(wallets: Wallet[], bucket: Bucket): number {
  return Math.round(
    wallets.filter((w) => w.bucket === bucket).reduce((s, w) => s + w.allocated, 0) * 100,
  ) / 100;
}

export function unallocated(settings: Settings, wallets: Wallet[], bucket: Bucket): number {
  const budget = bucket === 'basic' ? settings.basicBudget : settings.specialBudget;
  return Math.round((budget - allocatedSum(wallets, bucket)) * 100) / 100;
}

export function walletStatus(spent: number, allocated: number): BudgetStatus {
  return budgetStatus(spent, allocated);
}

export function normalizeWallet(raw: Partial<Wallet> & { id?: string }): Wallet | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uuid();
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '小荷包';
  const color =
    typeof raw.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.color)
      ? raw.color
      : WALLET_COLORS[0];
  const bucket: Bucket = raw.bucket === 'special' ? 'special' : 'basic';
  const allocated =
    typeof raw.allocated === 'number' && Number.isFinite(raw.allocated)
      ? Math.max(0, Math.round(raw.allocated * 100) / 100)
      : 0;
  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString();
  return { id, name, color, bucket, allocated, createdAt };
}

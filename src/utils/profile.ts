import type { Bucket, PaymentMethod, Settings, Transaction, TxKind, TxType } from '../types';
import { isCurrency } from './currency';
import { normalizeTxDate } from './dates';
import { normalizeMonthOpeningForImport, normalizeSettings } from './storage';

/** Portable plan pack (settings overlay + optional transaction seed). */
export interface LedgerProfilePack {
  version: number;
  id?: string;
  name?: string;
  label?: string;
  description?: string;
  settings: Partial<Settings>;
  /** Optional txs to merge by id (skip duplicates). Does not replace existing. */
  transactions?: Transaction[];
}

/** Strip control chars / brackets; cap length for safe UI display (no HTML injection). */
export function safeProfileLabel(raw: unknown, fallback = '计划配置'): string {
  if (typeof raw !== 'string') return fallback;
  const s = raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>&"`]/g, '')
    .trim()
    .slice(0, 80);
  return s || fallback;
}

function asPlainObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (Object.prototype.hasOwnProperty.call(raw, '__proto__')) return null;
  const o = raw as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(o, 'constructor')) {
    const { constructor: _c, ...rest } = o;
    return rest;
  }
  return o;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isTxType(v: unknown): v is TxType {
  return v === 'expense' || v === 'income';
}

function isTxKind(v: unknown): v is TxKind {
  return v === 'normal' || v === 'topup';
}

function isBucket(v: unknown): v is Bucket {
  return v === 'basic' || v === 'special';
}

function isPaymentMethod(v: unknown): v is PaymentMethod {
  return (
    v === 'octopus' ||
    v === 'wechat' ||
    v === 'alipay' ||
    v === 'bank' ||
    v === 'credit' ||
    v === 'other' ||
    v === 'none'
  );
}

/** Validate & normalize optional profile-pack transactions (skip invalid rows). */
export function parseProfileTransactions(raw: unknown): Transaction[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error('transactions 必须是数组');
  }
  if (raw.length > 5000) {
    throw new Error('transactions 过多');
  }
  const out: Transaction[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const o = asPlainObject(item);
    if (!o) continue;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    if (!id || id.length > 80 || seen.has(id)) continue;
    if (!isTxType(o.type)) continue;
    const kind: TxKind = isTxKind(o.kind) ? o.kind : 'normal';
    const dateRaw = typeof o.date === 'string' ? o.date : '';
    const date = normalizeTxDate(dateRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const amount = typeof o.amount === 'number' ? o.amount : Number(o.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = isCurrency(o.currency) ? o.currency : null;
    if (!currency) continue;
    const rate = typeof o.rate === 'number' ? o.rate : Number(o.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    let amountRmb =
      typeof o.amountRmb === 'number' ? o.amountRmb : Number(o.amountRmb);
    if (!Number.isFinite(amountRmb) || amountRmb <= 0) {
      amountRmb = round2(amount * rate);
    } else {
      amountRmb = round2(amountRmb);
    }
    const categoryId = typeof o.categoryId === 'string' ? o.categoryId.trim() : '';
    if (!categoryId || categoryId.length > 64) continue;
    const bucket: Bucket = isBucket(o.bucket) ? o.bucket : 'basic';
    const note = typeof o.note === 'string' ? o.note.slice(0, 200) : '';
    const paymentMethod: PaymentMethod = isPaymentMethod(o.paymentMethod)
      ? o.paymentMethod
      : kind === 'topup'
        ? 'octopus'
        : 'none';
    const createdAt =
      typeof o.createdAt === 'string' && o.createdAt
        ? o.createdAt.slice(0, 40)
        : `${date}T12:00:00.000Z`;
    const walletId =
      typeof o.walletId === 'string' && o.walletId
        ? o.walletId
        : o.walletId === null
          ? null
          : null;

    seen.add(id);
    out.push({
      id,
      type: o.type,
      kind,
      date,
      amount: round2(amount),
      currency,
      rate: round2(rate),
      amountRmb,
      categoryId,
      bucket,
      note,
      isSpecial: Boolean(o.isSpecial),
      isMonthly: Boolean(o.isMonthly),
      paymentMethod,
      walletId,
      createdAt,
    });
  }
  return out;
}

/**
 * Merge pack txs into existing by id (skip duplicates).
 * New txs are prepended (newest-first list convention).
 */
export function mergeProfileTransactions(
  existing: Transaction[],
  incoming: Transaction[] | undefined,
): { transactions: Transaction[]; added: number } {
  if (!incoming || incoming.length === 0) {
    return { transactions: existing, added: 0 };
  }
  const ids = new Set(existing.map((t) => t.id));
  const toAdd = incoming.filter((t) => t.id && !ids.has(t.id));
  if (toAdd.length === 0) {
    return { transactions: existing, added: 0 };
  }
  return { transactions: [...toAdd, ...existing], added: toAdd.length };
}

export function isLedgerProfilePack(raw: unknown): raw is LedgerProfilePack {
  const o = asPlainObject(raw);
  if (!o) return false;
  if (typeof o.version !== 'number' || !Number.isFinite(o.version)) return false;
  if (!asPlainObject(o.settings)) return false;
  if (o.transactions != null && !Array.isArray(o.transactions)) return false;
  return true;
}

export function parseProfilePack(text: string): LedgerProfilePack {
  if (typeof text !== 'string' || text.length > 512_000) {
    throw new Error('配置内容过大或无效');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('JSON 解析失败');
  }
  if (!isLedgerProfilePack(raw)) {
    throw new Error('不是有效的计划配置（需要 version + settings）');
  }
  const o = raw;
  return {
    version: o.version,
    id: typeof o.id === 'string' ? safeProfileLabel(o.id, '') || undefined : undefined,
    name: typeof o.name === 'string' ? safeProfileLabel(o.name, '') || undefined : undefined,
    label: typeof o.label === 'string' ? safeProfileLabel(o.label, '') || undefined : undefined,
    description:
      typeof o.description === 'string'
        ? safeProfileLabel(o.description, '') || undefined
        : undefined,
    settings: { ...(o.settings as Partial<Settings>) },
    transactions: parseProfileTransactions(o.transactions),
  };
}

/**
 * Merge profile settings into current settings with full normalize/validation.
 * Explicitly applies monthOpening (including null to clear).
 */
export function mergeProfileSettings(
  current: Settings,
  pack: LedgerProfilePack,
): Settings {
  const incoming = asPlainObject(pack.settings) ?? {};
  delete (incoming as { __proto__?: unknown }).__proto__;

  const dailyPlanIn = asPlainObject(incoming.dailyPlan);
  const fixedRatesIn = asPlainObject(incoming.fixedRates);
  const liveRatesIn = asPlainObject(incoming.liveRates);
  const satIn = asPlainObject(incoming.satModeOverrides);

  let monthOpening: Settings['monthOpening'] | undefined = current.monthOpening;
  if ('monthOpening' in incoming) {
    const normalized = normalizeMonthOpeningForImport(incoming.monthOpening);
    monthOpening = normalized === undefined ? null : normalized;
  }

  const candidate: Settings = {
    ...current,
    ...(incoming as Partial<Settings>),
    dailyPlan: dailyPlanIn
      ? { ...current.dailyPlan, ...(dailyPlanIn as unknown as Settings['dailyPlan']) }
      : current.dailyPlan,
    fixedRates: fixedRatesIn
      ? { ...current.fixedRates, ...(fixedRatesIn as unknown as Settings['fixedRates']) }
      : current.fixedRates,
    liveRates: liveRatesIn
      ? { ...current.liveRates, ...(liveRatesIn as unknown as Settings['liveRates']) }
      : current.liveRates,
    preferredCurrencies: Array.isArray(incoming.preferredCurrencies)
      ? (incoming.preferredCurrencies as unknown as Settings['preferredCurrencies'])
      : current.preferredCurrencies,
    satModeOverrides: satIn
      ? { ...current.satModeOverrides, ...(satIn as unknown as Settings['satModeOverrides']) }
      : current.satModeOverrides,
    monthOpening: monthOpening === undefined ? current.monthOpening ?? null : monthOpening,
  };

  return normalizeSettings(candidate);
}

export async function fetchProfileFromUrl(url: string): Promise<LedgerProfilePack> {
  const u = url.trim();
  if (!/^https:\/\//i.test(u)) {
    throw new Error('请输入以 https:// 开头的链接');
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error('链接格式无效');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('仅支持 https 链接');
  }
  if (parsed.username || parsed.password) {
    throw new Error('链接不能包含账号密码');
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(parsed.toString(), {
      credentials: 'omit',
      mode: 'cors',
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`);
    const len = res.headers.get('content-length');
    if (len && Number(len) > 512_000) throw new Error('远程文件过大');
    const text = await res.text();
    return parseProfilePack(text);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('下载超时');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

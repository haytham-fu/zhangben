import type { MonthOpening, Settings } from '../types';
import { normalizeMonthOpeningForImport, normalizeSettings } from './storage';

/** Portable plan pack (settings overlay). Does not replace transactions. */
export interface LedgerProfilePack {
  version: number;
  id?: string;
  name?: string;
  label?: string;
  description?: string;
  settings: Partial<Settings>;
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

export function isLedgerProfilePack(raw: unknown): raw is LedgerProfilePack {
  const o = asPlainObject(raw);
  if (!o) return false;
  if (typeof o.version !== 'number' || !Number.isFinite(o.version)) return false;
  if (!asPlainObject(o.settings)) return false;
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

  let monthOpening: MonthOpening | null | undefined = current.monthOpening;
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

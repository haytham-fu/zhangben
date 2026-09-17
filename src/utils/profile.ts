import type { MonthOpening, Settings } from '../types';
import { normalizeMonthOpeningForImport } from './storage';

/** Portable plan pack (settings overlay). Does not replace transactions. */
export interface LedgerProfilePack {
  version: number;
  id?: string;
  name?: string;
  label?: string;
  description?: string;
  settings: Partial<Settings>;
}

export function isLedgerProfilePack(raw: unknown): raw is LedgerProfilePack {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'number') return false;
  if (!o.settings || typeof o.settings !== 'object') return false;
  return true;
}

export function parseProfilePack(text: string): LedgerProfilePack {
  const raw = JSON.parse(text) as unknown;
  if (!isLedgerProfilePack(raw)) {
    throw new Error('不是有效的计划配置（需要 version + settings）');
  }
  return raw;
}

/**
 * Merge profile settings into current settings.
 * Explicitly applies monthOpening (including null to clear).
 */
export function mergeProfileSettings(
  current: Settings,
  pack: LedgerProfilePack,
): Settings {
  const incoming = { ...pack.settings };
  let monthOpening: MonthOpening | null | undefined = current.monthOpening;
  if ('monthOpening' in incoming) {
    const normalized = normalizeMonthOpeningForImport(incoming.monthOpening);
    monthOpening = normalized === undefined ? null : normalized;
    delete incoming.monthOpening;
  }
  return {
    ...current,
    ...incoming,
    monthOpening: monthOpening === undefined ? current.monthOpening ?? null : monthOpening,
    // keep nested objects merged when provided
    dailyPlan: incoming.dailyPlan
      ? { ...current.dailyPlan, ...incoming.dailyPlan }
      : current.dailyPlan,
    fixedRates: incoming.fixedRates
      ? { ...current.fixedRates, ...incoming.fixedRates }
      : current.fixedRates,
    liveRates: incoming.liveRates
      ? { ...current.liveRates, ...incoming.liveRates }
      : current.liveRates,
    preferredCurrencies: incoming.preferredCurrencies ?? current.preferredCurrencies,
    satModeOverrides: incoming.satModeOverrides
      ? { ...current.satModeOverrides, ...incoming.satModeOverrides }
      : current.satModeOverrides,
  };
}

export async function fetchProfileFromUrl(url: string): Promise<LedgerProfilePack> {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    throw new Error('请输入以 http(s):// 开头的链接');
  }
  const res = await fetch(u, { credentials: 'omit' });
  if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`);
  const text = await res.text();
  return parseProfilePack(text);
}

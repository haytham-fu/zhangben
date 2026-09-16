import type { Currency, ForeignCurrency, Settings } from '../types';
import {
  CURRENCY_META,
  DEFAULT_FIXED_RATES,
  FOREIGN_CURRENCIES,
  getFixedRate,
  isForeignCurrency,
} from './currency';

const CACHE_MS = 30 * 60 * 1000; // 30 minutes

export type RateSource = 'live' | 'fixed' | 'fallback';

export interface ResolvedRate {
  rate: number;
  source: RateSource;
  /** Short Chinese note for UI */
  note: string;
  fetchedAt?: string;
}

export interface LiveBundle {
  rates: Partial<Record<ForeignCurrency, number>>;
  fetchedAt: string;
}

let memCache: LiveBundle | null = null;

function fromSettingsCache(settings: Settings): LiveBundle | null {
  const rates = settings.liveRates ?? {};
  const keys = Object.keys(rates).filter(isForeignCurrency);
  if (keys.length === 0 || !settings.liveRatesUpdatedAt) return null;
  return { rates: { ...rates }, fetchedAt: settings.liveRatesUpdatedAt };
}

function isFresh(iso: string): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < CACHE_MS;
}

function roundRate(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}

/** Invert "foreign per 1 CNY" map into "RMB per 1 foreign". */
function invertCnyMap(cnyPerForeignInverse: Record<string, number>): Partial<Record<ForeignCurrency, number>> {
  const out: Partial<Record<ForeignCurrency, number>> = {};
  for (const fc of FOREIGN_CURRENCIES) {
    const api = CURRENCY_META[fc].apiCode.toLowerCase();
    const upper = CURRENCY_META[fc].apiCode;
    const perCny = cnyPerForeignInverse[api] ?? cnyPerForeignInverse[upper];
    if (typeof perCny === 'number' && perCny > 0) {
      out[fc] = roundRate(1 / perCny);
    }
  }
  return out;
}

/** Fetch all supported foreign → RMB from free public APIs (no key). */
export async function fetchLiveRates(): Promise<LiveBundle> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // Primary: open.er-api.com CNY base → invert
    const res = await fetch('https://open.er-api.com/v6/latest/CNY', {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('er-api http');
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!json.rates) throw new Error('er-api parse');
    const rates = invertCnyMap(json.rates);
    if (Object.keys(rates).length < 2) throw new Error('er-api sparse');
    // Fill any missing with defaults so UI always has a number
    for (const fc of FOREIGN_CURRENCIES) {
      if (rates[fc] == null) rates[fc] = DEFAULT_FIXED_RATES[fc];
    }
    const bundle: LiveBundle = {
      rates,
      fetchedAt: new Date().toISOString(),
    };
    memCache = bundle;
    return bundle;
  } catch {
    // Fallback CDN currency-api (CNY → foreign units)
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cny.min.json',
      { signal: controller.signal },
    );
    if (!res.ok) throw new Error('cdn http');
    const json = (await res.json()) as { cny?: Record<string, number> };
    if (!json.cny) throw new Error('cdn parse');
    const rates = invertCnyMap(json.cny);
    if (Object.keys(rates).length < 2) throw new Error('cdn sparse');
    for (const fc of FOREIGN_CURRENCIES) {
      if (rates[fc] == null) rates[fc] = DEFAULT_FIXED_RATES[fc];
    }
    const bundle: LiveBundle = {
      rates,
      fetchedAt: new Date().toISOString(),
    };
    memCache = bundle;
    return bundle;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveRate(
  currency: Currency,
  settings: Settings,
): Promise<ResolvedRate> {
  if (currency === 'RMB') {
    return { rate: 1, source: 'fixed', note: '人民币无需换算' };
  }

  if (settings.fxRateMode !== 'live') {
    const rate = getFixedRate(currency, settings);
    return {
      rate,
      source: 'fixed',
      note: `固定汇率 1 ${currency} = ${rate} RMB`,
    };
  }

  const cached =
    (memCache && isFresh(memCache.fetchedAt) && memCache) ||
    (() => {
      const s = fromSettingsCache(settings);
      return s && isFresh(s.fetchedAt) ? s : null;
    })() ||
    (memCache && memCache) ||
    fromSettingsCache(settings);

  try {
    const bundle =
      cached && isFresh(cached.fetchedAt) ? cached : await fetchLiveRates();
    const rate = bundle.rates[currency] ?? getFixedRate(currency, settings);
    return {
      rate,
      source: 'live',
      note: `实时汇率 1 ${currency} = ${rate} RMB`,
      fetchedAt: bundle.fetchedAt,
    };
  } catch {
    const rate =
      cached?.rates[currency] ?? getFixedRate(currency, settings);
    const usingCache = cached?.rates[currency] != null;
    return {
      rate,
      source: 'fallback',
      note: usingCache
        ? `实时汇率暂不可用，使用缓存 ${rate}（已回退）`
        : `实时汇率暂不可用，使用固定汇率 ${rate}`,
      fetchedAt: cached?.fetchedAt,
    };
  }
}

export function applyLiveBundleToSettings(bundle: LiveBundle): Partial<Settings> {
  return {
    liveRates: { ...bundle.rates },
    liveRatesUpdatedAt: bundle.fetchedAt,
  };
}

export function formatLiveRatesSummary(
  rates: Partial<Record<ForeignCurrency, number>>,
  preferred: Currency[],
): string {
  const focus = preferred.filter(isForeignCurrency).slice(0, 4);
  const list = (focus.length > 0 ? focus : (['HKD', 'USD'] as ForeignCurrency[])).map(
    (c) => `1 ${c}=${rates[c] ?? '—'}`,
  );
  return list.join(' · ');
}

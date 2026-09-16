import type { Currency, Settings } from '../types';

const CACHE_MS = 30 * 60 * 1000; // 30 minutes

export type RateSource = 'live' | 'fixed' | 'fallback';

export interface ResolvedRate {
  rate: number;
  source: RateSource;
  /** Short Chinese note for UI */
  note: string;
  fetchedAt?: string;
}

interface LiveBundle {
  hkd: number;
  usd: number;
  fetchedAt: string;
}

let memCache: LiveBundle | null = null;

function fixedRate(currency: Currency, settings: Settings): number {
  if (currency === 'RMB') return 1;
  if (currency === 'HKD') return settings.hkdRate;
  return settings.usdRate;
}

function fromSettingsCache(settings: Settings): LiveBundle | null {
  if (
    settings.liveHkdRate != null &&
    settings.liveUsdRate != null &&
    settings.liveRatesUpdatedAt
  ) {
    return {
      hkd: settings.liveHkdRate,
      usd: settings.liveUsdRate,
      fetchedAt: settings.liveRatesUpdatedAt,
    };
  }
  return null;
}

function isFresh(iso: string): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < CACHE_MS;
}

/** Fetch HKD→CNY and USD→CNY from free public APIs (no key). */
export async function fetchLiveRates(): Promise<LiveBundle> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // Primary: open.er-api.com (no key)
    const [hkdRes, usdRes] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/HKD', { signal: controller.signal }),
      fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal }),
    ]);
    if (!hkdRes.ok || !usdRes.ok) throw new Error('er-api http');
    const hkdJson = (await hkdRes.json()) as { rates?: { CNY?: number } };
    const usdJson = (await usdRes.json()) as { rates?: { CNY?: number } };
    const hkd = hkdJson.rates?.CNY;
    const usd = usdJson.rates?.CNY;
    if (typeof hkd !== 'number' || typeof usd !== 'number') throw new Error('er-api parse');
    const bundle: LiveBundle = {
      hkd: Math.round(hkd * 10000) / 10000,
      usd: Math.round(usd * 10000) / 10000,
      fetchedAt: new Date().toISOString(),
    };
    memCache = bundle;
    return bundle;
  } catch {
    // Fallback CDN currency-api
    const [hkdRes, usdRes] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/hkd.min.json', {
        signal: controller.signal,
      }),
      fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json', {
        signal: controller.signal,
      }),
    ]);
    if (!hkdRes.ok || !usdRes.ok) throw new Error('cdn http');
    const hkdJson = (await hkdRes.json()) as { hkd?: { cny?: number } };
    const usdJson = (await usdRes.json()) as { usd?: { cny?: number } };
    const hkd = hkdJson.hkd?.cny;
    const usd = usdJson.usd?.cny;
    if (typeof hkd !== 'number' || typeof usd !== 'number') throw new Error('cdn parse');
    const bundle: LiveBundle = {
      hkd: Math.round(hkd * 10000) / 10000,
      usd: Math.round(usd * 10000) / 10000,
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
    const rate = fixedRate(currency, settings);
    return {
      rate,
      source: 'fixed',
      note: `固定汇率 1 ${currency} = ${rate} RMB`,
    };
  }

  // Live mode
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
    const rate = currency === 'HKD' ? bundle.hkd : bundle.usd;
    return {
      rate,
      source: 'live',
      note: `实时汇率 1 ${currency} = ${rate} RMB`,
      fetchedAt: bundle.fetchedAt,
    };
  } catch {
    const rate = cached
      ? currency === 'HKD'
        ? cached.hkd
        : cached.usd
      : fixedRate(currency, settings);
    const usingCache = Boolean(cached);
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
    liveHkdRate: bundle.hkd,
    liveUsdRate: bundle.usd,
    liveRatesUpdatedAt: bundle.fetchedAt,
  };
}

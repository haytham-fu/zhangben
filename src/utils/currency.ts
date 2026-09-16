import type { Currency, ForeignCurrency, Settings } from '../types';

export const ALL_CURRENCIES: Currency[] = [
  'RMB',
  'HKD',
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'TWD',
  'MOP',
  'SGD',
];

export const FOREIGN_CURRENCIES: ForeignCurrency[] = [
  'HKD',
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'TWD',
  'MOP',
  'SGD',
];

export const CURRENCY_META: Record<
  Currency,
  { label: string; zh: string; short: string; symbol: string; apiCode: string }
> = {
  RMB: { label: '人民币 RMB', zh: '人民币', short: 'RMB', symbol: '¥', apiCode: 'CNY' },
  HKD: { label: '港币 HKD', zh: '港币', short: 'HKD', symbol: 'HK$', apiCode: 'HKD' },
  USD: { label: '美元 USD', zh: '美元', short: 'USD', symbol: '$', apiCode: 'USD' },
  EUR: { label: '欧元 EUR', zh: '欧元', short: 'EUR', symbol: '€', apiCode: 'EUR' },
  JPY: { label: '日元 JPY', zh: '日元', short: 'JPY', symbol: '¥', apiCode: 'JPY' },
  GBP: { label: '英镑 GBP', zh: '英镑', short: 'GBP', symbol: '£', apiCode: 'GBP' },
  TWD: { label: '新台币 TWD', zh: '新台币', short: 'TWD', symbol: 'NT$', apiCode: 'TWD' },
  MOP: { label: '澳门币 MOP', zh: '澳门币', short: 'MOP', symbol: 'MOP$', apiCode: 'MOP' },
  SGD: { label: '新加坡元 SGD', zh: '新加坡元', short: 'SGD', symbol: 'S$', apiCode: 'SGD' },
};

export const DEFAULT_FIXED_RATES: Record<ForeignCurrency, number> = {
  HKD: 0.86,
  USD: 7.2,
  EUR: 7.8,
  JPY: 0.048,
  GBP: 9.2,
  TWD: 0.23,
  MOP: 0.84,
  SGD: 5.4,
};

export const DEFAULT_PREFERRED_CURRENCIES: Currency[] = ['RMB', 'HKD', 'USD', 'EUR'];

export function isCurrency(v: unknown): v is Currency {
  return typeof v === 'string' && (ALL_CURRENCIES as string[]).includes(v);
}

export function isForeignCurrency(v: unknown): v is ForeignCurrency {
  return typeof v === 'string' && (FOREIGN_CURRENCIES as string[]).includes(v);
}

/** Clamp / normalize preferred list (max 4, unique, valid). */
export function normalizePreferredCurrencies(list: unknown): Currency[] {
  const out: Currency[] = [];
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!isCurrency(item)) continue;
      if (out.includes(item)) continue;
      out.push(item);
      if (out.length >= 4) break;
    }
  }
  if (out.length === 0) return [...DEFAULT_PREFERRED_CURRENCIES];
  return out;
}

/** Picker order: preferred first, then remaining supported. */
export function orderedCurrenciesForPicker(preferred: Currency[]): Currency[] {
  const prefs = normalizePreferredCurrencies(preferred);
  const rest = ALL_CURRENCIES.filter((c) => !prefs.includes(c));
  return [...prefs, ...rest];
}

export function getFixedRate(currency: Currency, settings: Settings): number {
  if (currency === 'RMB') return 1;
  return settings.fixedRates[currency] ?? DEFAULT_FIXED_RATES[currency];
}

/** Sync rate: fixed mode uses editable rates; live mode prefers cached live rates. */
export function getRate(currency: Currency, settings: Settings): number {
  if (currency === 'RMB') return 1;
  if (settings.fxRateMode === 'live') {
    return settings.liveRates[currency] ?? getFixedRate(currency, settings);
  }
  return getFixedRate(currency, settings);
}

export function toRmb(amount: number, currency: Currency, settings: Settings): number {
  return Math.round(amount * getRate(currency, settings) * 100) / 100;
}

export function toRmbWithRate(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function formatMoney(amount: number, currency: Currency = 'RMB', digits = 2): string {
  const symbol = CURRENCY_META[currency]?.symbol ?? '';
  return `${symbol}${amount.toFixed(digits)}`;
}

export function formatRmb(amount: number, digits = 2): string {
  return `¥${amount.toFixed(digits)}`;
}

export function setFixedRate(
  settings: Settings,
  currency: ForeignCurrency,
  rate: number,
): Record<ForeignCurrency, number> {
  return { ...settings.fixedRates, [currency]: rate };
}

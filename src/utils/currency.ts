import type { Currency, Settings } from '../types';

/** Sync rate: fixed mode uses editable rates; live mode prefers cached live rates. */
export function getRate(currency: Currency, settings: Settings): number {
  if (currency === 'RMB') return 1;
  if (settings.fxRateMode === 'live') {
    if (currency === 'HKD') return settings.liveHkdRate ?? settings.hkdRate;
    return settings.liveUsdRate ?? settings.usdRate;
  }
  if (currency === 'HKD') return settings.hkdRate;
  return settings.usdRate;
}

export function toRmb(amount: number, currency: Currency, settings: Settings): number {
  return Math.round(amount * getRate(currency, settings) * 100) / 100;
}

export function toRmbWithRate(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function formatMoney(amount: number, currency: Currency = 'RMB', digits = 2): string {
  const symbol = currency === 'RMB' ? '¥' : currency === 'HKD' ? 'HK$' : '$';
  return `${symbol}${amount.toFixed(digits)}`;
}

export function formatRmb(amount: number, digits = 2): string {
  return `¥${amount.toFixed(digits)}`;
}

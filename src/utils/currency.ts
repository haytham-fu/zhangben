import type { Currency, Settings } from '../types';

export function getRate(currency: Currency, settings: Settings): number {
  if (currency === 'RMB') return 1;
  if (currency === 'HKD') return settings.hkdRate;
  return settings.usdRate;
}

export function toRmb(amount: number, currency: Currency, settings: Settings): number {
  return Math.round(amount * getRate(currency, settings) * 100) / 100;
}

export function formatMoney(amount: number, currency: Currency = 'RMB', digits = 2): string {
  const symbol = currency === 'RMB' ? '¥' : currency === 'HKD' ? 'HK$' : '$';
  return `${symbol}${amount.toFixed(digits)}`;
}

export function formatRmb(amount: number, digits = 2): string {
  return `¥${amount.toFixed(digits)}`;
}

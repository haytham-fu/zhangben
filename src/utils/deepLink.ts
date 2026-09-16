import type { Currency } from '../types';
import { ALL_CURRENCIES, isCurrency } from './currency';

export interface DeepLinkAddPrefill {
  amount: string;
  currency: Currency;
  note: string;
}

/** First money-like number in OCR / raw text (e.g. HK$12.34, ¥8, 12.5). */
export function parseFirstMoneyAmount(text: string): string | null {
  const re =
    /(?:HK\$|HKD|￥|¥|\$|€|£|NT\$|MOP\$|S\$)?\s*(\d{1,6}(?:\.\d{1,2})?)\s*(?:元|港幣|港币)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = parseFloat(m[1]);
    if (Number.isNaN(value) || value <= 0 || value > 999999) continue;
    // Skip bare years mistaken as amounts
    if (value >= 2000 && value <= 2099 && !m[1].includes('.')) continue;
    return m[1];
  }
  return null;
}

function parseCurrency(raw: string | null): Currency {
  if (!raw) return 'RMB';
  const u = raw.trim().toUpperCase();
  if (u === 'CNY' || u === 'CNH') return 'RMB';
  if (isCurrency(u)) return u;
  return 'RMB';
}

/**
 * Read Shortcuts / deep-link query from current URL.
 * Supports: ?action=add&amount=&currency=&note=&text=
 * If amount missing, parse first money-like number from text=.
 */
export function consumeDeepLinkFromLocation(): DeepLinkAddPrefill | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (action !== 'add') return null;

  let amount = (params.get('amount') ?? '').trim();
  const text = params.get('text') ?? '';
  if (!amount && text) {
    amount = parseFirstMoneyAmount(text) ?? '';
  }
  const currency = parseCurrency(params.get('currency'));
  const note = (params.get('note') ?? '').trim();

  // Clear query so refresh does not re-trigger
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.pathname + url.hash);

  return { amount, currency, note };
}

export { ALL_CURRENCIES };

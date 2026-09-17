import { format } from 'date-fns';

/** Local calendar date as YYYY-MM-DD (never UTC ISO date-only pitfalls). */
export function localDateStr(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}

/** Local month key YYYY-MM. */
export function localMonthKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM');
}

/**
 * Normalize any stored transaction date to YYYY-MM-DD.
 * Accepts plain dates or accidental full ISO datetimes.
 */
export function normalizeTxDate(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return localDateStr();
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(trimmed);
  if (!Number.isNaN(t)) return localDateStr(new Date(t));
  return localDateStr();
}

export function isDateOnOrAfter(a: string, b: string): boolean {
  return normalizeTxDate(a) >= normalizeTxDate(b);
}

export function isSameTxDate(a: string, b: string): boolean {
  return normalizeTxDate(a) === normalizeTxDate(b);
}

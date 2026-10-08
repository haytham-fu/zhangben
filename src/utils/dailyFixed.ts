import { addDays, format, isValid, parseISO } from 'date-fns';
import type { AppState, DailyFixedExpense, Transaction } from '../types';
import { roundMoney } from './grocery';

function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

export function normalizeDailyFixedExpenses(raw: unknown): DailyFixedExpense[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, DailyFixedExpense>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Partial<DailyFixedExpense>;
    if (typeof r.id !== 'string' || !r.id.trim() ||
        typeof r.name !== 'string' || !r.name.trim() ||
        typeof r.categoryId !== 'string' || !r.categoryId.trim() ||
        !validDay(r.startDate) ||
        typeof r.amountRmb !== 'number' || !Number.isFinite(r.amountRmb) ||
        r.amountRmb < 0.01 || r.amountRmb > 1_000_000) continue;
    const rule: DailyFixedExpense = {
      id: r.id.trim().slice(0, 80),
      name: r.name.trim().slice(0, 40),
      amountRmb: roundMoney(r.amountRmb),
      categoryId: r.categoryId.trim().slice(0, 80),
      bucket: r.bucket === 'special' ? 'special' : 'basic',
      startDate: r.startDate,
      updatedAt: typeof r.updatedAt === 'string' && !Number.isNaN(Date.parse(r.updatedAt))
        ? r.updatedAt : `${r.startDate}T00:00:00.000Z`,
      stoppedOn: validDay(r.stoppedOn) ? r.stoppedOn : undefined,
    };
    byId.set(rule.id, rule);
  }
  return [...byId.values()];
}

export function dailyFixedTransaction(rule: DailyFixedExpense, day: string): Transaction {
  return {
    id: `daily-fixed:${rule.id}:${day}`,
    type: 'expense',
    kind: 'normal',
    date: day,
    amount: rule.amountRmb,
    currency: 'RMB',
    rate: 1,
    amountRmb: rule.amountRmb,
    categoryId: rule.categoryId,
    bucket: rule.bucket,
    note: rule.name,
    isSpecial: false,
    isMonthly: false,
    dailyFixedRuleId: rule.id,
    paymentMethod: 'none',
    walletId: null,
    createdAt: `${day}T12:00:00.000Z`,
  };
}

/** Catch up missed calendar days, exactly once each; stopped rules preserve earlier rows. */
export function materializeDailyFixed(state: AppState, today: string): AppState {
  if (!validDay(today)) return state;
  const rules = state.settings.dailyFixedExpenses ?? [];
  if (rules.length === 0) return state;
  const byId = new Map(rules.map((r) => [r.id, r]));
  const seen = new Set<string>();
  let changed = false;
  const kept = state.transactions.filter((tx) => {
    if (!tx.dailyFixedRuleId) return true;
    const rule = byId.get(tx.dailyFixedRuleId);
    if (rule?.stoppedOn && tx.date >= rule.stoppedOn) {
      changed = true;
      return false;
    }
    const key = `${tx.dailyFixedRuleId}:${tx.date}`;
    if (seen.has(key)) {
      changed = true;
      return false;
    }
    seen.add(key);
    return true;
  });
  const added: Transaction[] = [];
  for (const rule of rules) {
    if (!validDay(rule.startDate) || rule.startDate > today) continue;
    let day = parseISO(rule.startDate);
    const last = rule.stoppedOn && rule.stoppedOn <= today ? rule.stoppedOn : null;
    while (true) {
      const date = format(day, 'yyyy-MM-dd');
      if (date > today || (last && date >= last)) break;
      const key = `${rule.id}:${date}`;
      if (!seen.has(key)) {
        added.push(dailyFixedTransaction(rule, date));
        seen.add(key);
      }
      day = addDays(day, 1);
    }
  }
  if (!changed && added.length === 0) return state;
  return { ...state, transactions: [...added.reverse(), ...kept] };
}

/** Newer edits win; a stop wins a timestamp tie so stale syncs cannot reactivate it. */
export function mergeDailyFixedExpenses(
  local: DailyFixedExpense[], remote: DailyFixedExpense[],
): DailyFixedExpense[] {
  const merged = new Map(local.map((rule) => [rule.id, rule]));
  for (const rule of remote) {
    const old = merged.get(rule.id);
    if (!old || rule.updatedAt > old.updatedAt ||
        (rule.updatedAt === old.updatedAt && !!rule.stoppedOn && !old.stoppedOn)) {
      merged.set(rule.id, rule);
    }
  }
  return [...merged.values()];
}

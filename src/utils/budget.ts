import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  startOfDay,
} from 'date-fns';
import type { SatMode, Settings, Transaction } from '../types';
import { normalizeTxDate, parseLocalDate } from './dates';

export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return format(d, 'yyyy-MM');
}

export function getSatMode(dateStr: string, settings: Settings): SatMode {
  return settings.satModeOverrides[dateStr] ?? settings.defaultSatMode;
}

export function getDailyPlanAmount(dateStr: string, settings: Settings): number {
  const d = parseLocalDate(dateStr);
  const dow = getDay(d); // 0=Sun ... 6=Sat
  const p = settings.dailyPlan;
  switch (dow) {
    case 1:
      return p.mon;
    case 2:
      return p.tue;
    case 3:
      return p.wed;
    case 4:
      return p.thu;
    case 5:
      return p.fri;
    case 6:
      return getSatMode(dateStr, settings) === 'play' ? p.satPlay : p.satStay;
    case 0:
      return p.sun;
    default:
      return 0;
  }
}

/** 买菜只入库，做饭使用食材时才计入预算。 */
export function isBudgetExpense(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.kind !== 'topup' && !tx.isGroceryPurchase;
}

export function isBudgetIncome(tx: Transaction): boolean {
  return tx.type === 'income';
}

export function filterMonth(txs: Transaction[], ym: string): Transaction[] {
  return txs.filter((t) => normalizeTxDate(t.date).startsWith(ym));
}

export function isSpreadAc(tx: Transaction): boolean {
  return tx.categoryId === 'ac' && isBudgetExpense(tx) &&
    Number.isInteger(tx.spreadDays) && (tx.spreadDays ?? 0) > 1 && (tx.spreadDays ?? 0) <= 365;
}

export function isSpreadSundry(tx: Transaction): boolean {
  return tx.categoryId === 'sundries' && isBudgetExpense(tx) &&
    Number.isInteger(tx.spreadDays) && (tx.spreadDays ?? 0) > 1 && (tx.spreadDays ?? 0) <= 365;
}

export function isSpreadExpense(tx: Transaction): boolean {
  return isSpreadAc(tx) || isSpreadSundry(tx);
}

/** Exact cent allocation: e.g. ¥100 / 3 = 33.34 + 33.33 + 33.33. */
export function expenseOnDate(tx: Transaction, dateStr: string): number {
  if (!isBudgetExpense(tx)) return 0;
  const date = normalizeTxDate(dateStr);
  if (!isSpreadExpense(tx)) return normalizeTxDate(tx.date) === date ? tx.amountRmb : 0;
  const offset = differenceInCalendarDays(parseLocalDate(date), parseLocalDate(tx.date));
  const days = tx.spreadDays!;
  if (offset < 0 || offset >= days) return 0;
  const cents = Math.round(tx.amountRmb * 100);
  const base = Math.floor(cents / days);
  return (base + (offset < cents % days ? 1 : 0)) / 100;
}

export function expenseInMonth(tx: Transaction, ym: string): number {
  if (!isBudgetExpense(tx)) return 0;
  if (!isSpreadExpense(tx)) return normalizeTxDate(tx.date).startsWith(ym) ? tx.amountRmb : 0;
  const start = parseLocalDate(tx.date);
  let cents = 0;
  for (let i = 0; i < tx.spreadDays!; i++) {
    const day = format(addDays(start, i), 'yyyy-MM-dd');
    if (day.startsWith(ym)) cents += Math.round(expenseOnDate(tx, day) * 100);
  }
  return cents / 100;
}

function netSpendInMonth(
  txs: Transaction[], ym: string, bucket: 'basic' | 'special', opts: { includeSpecial: boolean },
): number {
  let cents = 0;
  for (const tx of txs) {
    if (tx.bucket !== bucket || (!opts.includeSpecial && tx.isSpecial)) continue;
    if (isBudgetIncome(tx)) {
      if (normalizeTxDate(tx.date).startsWith(ym)) cents -= Math.round(tx.amountRmb * 100);
    } else cents += Math.round(expenseInMonth(tx, ym) * 100);
  }
  return cents / 100;
}

export function netBasicSpend(
  txs: Transaction[],
  opts: { includeSpecial: boolean },
): number {
  let sum = 0;
  for (const t of txs) {
    if (t.bucket !== 'basic') continue;
    if (!opts.includeSpecial && t.isSpecial) continue;
    if (isBudgetExpense(t)) sum += t.amountRmb;
    else if (isBudgetIncome(t)) sum -= t.amountRmb;
  }
  return Math.round(sum * 100) / 100;
}

export function specialSpend(txs: Transaction[], opts: { includeSpecial: boolean }): number {
  let sum = 0;
  for (const t of txs) {
    if (t.bucket !== 'special') continue;
    if (!opts.includeSpecial && t.isSpecial) continue;
    if (isBudgetExpense(t)) sum += t.amountRmb;
    else if (isBudgetIncome(t)) sum -= t.amountRmb;
  }
  return Math.round(sum * 100) / 100;
}


/** Prior-period opening for ym (0 if none / different month). */
export function monthOpeningUsed(
  settings: Settings,
  ym: string,
): { basicUsed: number; specialUsed: number } {
  const o = settings.monthOpening;
  if (!o || o.ym !== ym) return { basicUsed: 0, specialUsed: 0 };
  return {
    basicUsed: Math.round((o.basicUsed || 0) * 100) / 100,
    specialUsed: Math.round((o.specialUsed || 0) * 100) / 100,
  };
}

/** Month basic used = opening + txs */
export function monthBasicUsed(
  txs: Transaction[],
  settings: Settings,
  ym: string,
  opts: { includeSpecial: boolean },
): number {
  const fromTxs = netSpendInMonth(txs, ym, 'basic', opts);
  const open = monthOpeningUsed(settings, ym).basicUsed;
  return Math.round((fromTxs + open) * 100) / 100;
}

/** Month special used = opening + txs */
export function monthSpecialUsed(
  txs: Transaction[],
  settings: Settings,
  ym: string,
  opts: { includeSpecial: boolean },
): number {
  const fromTxs = netSpendInMonth(txs, ym, 'special', opts);
  const open = monthOpeningUsed(settings, ym).specialUsed;
  return Math.round((fromTxs + open) * 100) / 100;
}

export function dayNetBasic(
  txs: Transaction[],
  dateStr: string,
  opts: { includeSpecial: boolean },
): number {
  const day = normalizeTxDate(dateStr);
  let cents = 0;
  for (const tx of txs) {
    if (tx.bucket !== 'basic' || (!opts.includeSpecial && tx.isSpecial)) continue;
    if (isBudgetIncome(tx) && normalizeTxDate(tx.date) === day) cents -= Math.round(tx.amountRmb * 100);
    else cents += Math.round(expenseOnDate(tx, day) * 100);
  }
  return cents / 100;
}

/** All budget-counting net spend for a calendar day (basic + special). */
export function dayNetAll(
  txs: Transaction[],
  dateStr: string,
  opts: { includeSpecial: boolean },
): number {
  const day = normalizeTxDate(dateStr);
  let cents = 0;
  for (const tx of txs) {
    if (!opts.includeSpecial && tx.isSpecial) continue;
    if (isBudgetIncome(tx) && normalizeTxDate(tx.date) === day) cents -= Math.round(tx.amountRmb * 100);
    else cents += Math.round(expenseOnDate(tx, day) * 100);
  }
  return cents / 100;
}

export function dayTxCount(txs: Transaction[], dateStr: string): number {
  const day = normalizeTxDate(dateStr);
  return txs.filter((t) => normalizeTxDate(t.date) === day).length;
}

export function plannedBasicToDate(ym: string, today: Date, settings: Settings): number {
  const start = startOfMonth(parseLocalDate(`${ym}-01`));
  const monthEnd = endOfMonth(start);
  const end = startOfDay(today) < startOfDay(monthEnd) ? startOfDay(today) : monthEnd;
  if (end < start) return 0;
  const days = eachDayOfInterval({ start, end });
  let sum = 0;
  for (const d of days) {
    sum += getDailyPlanAmount(format(d, 'yyyy-MM-dd'), settings);
  }
  return Math.round(sum * 100) / 100;
}

export function calendarProgress(ym: string, today: Date): number {
  const start = startOfMonth(parseLocalDate(`${ym}-01`));
  const monthEnd = endOfMonth(start);
  const totalDays = eachDayOfInterval({ start, end: monthEnd }).length;
  const todayStart = startOfDay(today);
  if (todayStart < start) return 0;
  if (todayStart > monthEnd) return 1;
  const elapsed = eachDayOfInterval({ start, end: todayStart }).length;
  return elapsed / totalDays;
}

/** Current-month pace, counting only dates through today (plus any imported opening balance). */
export function monthPaceSnapshot(
  txs: Transaction[], settings: Settings, ym: string, today: Date,
  opts: { includeSpecial: boolean },
) {
  const start = startOfMonth(parseLocalDate(`${ym}-01`));
  const end = endOfMonth(start);
  const through = startOfDay(today) < start ? null : startOfDay(today) > end ? end : startOfDay(today);
  const dates = through ? eachDayOfInterval({ start, end: through }) : [];
  const opening = monthOpeningUsed(settings, ym);
  let basicCents = Math.round(opening.basicUsed * 100);
  let specialCents = Math.round(opening.specialUsed * 100);
  for (const date of dates) {
    const day = format(date, 'yyyy-MM-dd');
    basicCents += Math.round(dayNetBasic(txs, day, opts) * 100);
    specialCents += Math.round((dayNetAll(txs, day, opts) - dayNetBasic(txs, day, opts)) * 100);
  }
  const basicUsed = basicCents / 100;
  const specialUsed = specialCents / 100;
  const totalUsed = (basicCents + specialCents) / 100;
  const totalBudget = settings.basicBudget + settings.specialBudget;
  const totalDays = eachDayOfInterval({ start, end }).length;
  const elapsedDays = dates.length;
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const pacedBudget = Math.round(totalBudget * elapsedDays / totalDays * 100) / 100;
  const paceDifference = Math.round((pacedBudget - totalUsed) * 100) / 100;
  const totalRemaining = Math.round((totalBudget - totalUsed) * 100) / 100;
  return {
    basicUsed, specialUsed, totalUsed, totalBudget, totalDays, elapsedDays, daysLeft,
    pacedBudget, paceDifference, totalRemaining,
    basicPlanned: plannedBasicToDate(ym, today, settings),
  };
}

export type BudgetStatus = 'safe' | 'near' | 'over' | 'severe';

export function budgetStatus(used: number, budget: number): BudgetStatus {
  if (budget <= 0) return used > 0 ? 'over' : 'safe';
  const ratio = used / budget;
  if (ratio >= 1.2) return 'severe';
  if (ratio >= 1) return 'over';
  if (ratio >= 0.85) return 'near';
  return 'safe';
}

/** For daily: compare used vs plan */
export function dailyStatus(used: number, plan: number): BudgetStatus {
  if (plan <= 0) return used > 0 ? 'over' : 'safe';
  const ratio = used / plan;
  if (ratio >= 1.5) return 'severe';
  if (ratio >= 1) return 'over';
  if (ratio >= 0.85) return 'near';
  return 'safe';
}

export function buildAdvice(
  txs: Transaction[],
  settings: Settings,
  ym: string,
  today: Date,
): string[] {
  const s = monthPaceSnapshot(txs, settings, ym, today,
    { includeSpecial: settings.includeSpecialInAdvice });
  const money = (n: number) => `¥${Math.abs(n).toFixed(2)}`;
  const tips = [
    `本月已过 ${s.elapsedDays}/${s.totalDays} 天；按生活费总预算 ${money(s.totalBudget)} 均匀分配，截至今天可用 ${money(s.pacedBudget)}，实际净支出 ${money(s.totalUsed)}。`,
    s.paceDifference >= 0
      ? `目前比预算进度少花 ${money(s.paceDifference)}；这是暂时的节奏盈余，不是月底最终结余。`
      : `目前比预算进度多花 ${money(-s.paceDifference)}；接下来需放慢支出，才能回到月预算内。`,
    `基础生活已用 ${money(s.basicUsed)} / ${money(settings.basicBudget)}；按每日计划累计 ${money(s.basicPlanned)}，${s.basicUsed <= s.basicPlanned ? `少花 ${money(s.basicPlanned - s.basicUsed)}` : `多花 ${money(s.basicUsed - s.basicPlanned)}`}。专项已用 ${money(s.specialUsed)} / ${money(settings.specialBudget)}。`,
    s.daysLeft > 0
      ? s.totalRemaining >= 0
        ? `本月还剩 ${money(s.totalRemaining)}，余下 ${s.daysLeft} 天平均每天可用约 ${money(s.totalRemaining / s.daysLeft)}（基础与专项合计）。`
        : `本月预算已超 ${money(-s.totalRemaining)}；余下 ${s.daysLeft} 天，建议优先保障吃饭和交通，暂停可推迟的专项购买。`
      : s.totalRemaining >= 0
        ? `本月结束时预计结余 ${money(s.totalRemaining)}。`
        : `本月结束时预计超支 ${money(-s.totalRemaining)}。`,
  ];
  if (settings.specialBudget > 0 && settings.specialBudget - s.specialUsed < settings.specialBudget * 0.1) {
    tips.push(`专项额度只剩 ${money(settings.specialBudget - s.specialUsed)}，会员与日用品等新增开销要留意。`);
  }
  if (!settings.includeSpecialInAdvice) {
    tips.push('上述实际净支出已排除标为「特例」的记录。');
  }

  return tips;
}

export function weekdayLabel(dateStr: string): string {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return `周${labels[getDay(parseLocalDate(dateStr))]}`;
}

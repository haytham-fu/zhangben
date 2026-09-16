import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfDay,
} from 'date-fns';
import type { SatMode, Settings, Transaction } from '../types';

export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM');
}

export function getSatMode(dateStr: string, settings: Settings): SatMode {
  return settings.satModeOverrides[dateStr] ?? settings.defaultSatMode;
}

export function getDailyPlanAmount(dateStr: string, settings: Settings): number {
  const d = parseISO(dateStr);
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

/** Budget-counting expense: not topup; expense type */
export function isBudgetExpense(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.kind !== 'topup';
}

export function isBudgetIncome(tx: Transaction): boolean {
  return tx.type === 'income';
}

export function filterMonth(txs: Transaction[], ym: string): Transaction[] {
  return txs.filter((t) => t.date.startsWith(ym));
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

export function dayNetBasic(
  txs: Transaction[],
  dateStr: string,
  opts: { includeSpecial: boolean },
): number {
  return netBasicSpend(
    txs.filter((t) => t.date === dateStr),
    opts,
  );
}

export function plannedBasicToDate(ym: string, today: Date, settings: Settings): number {
  const start = startOfMonth(parseISO(`${ym}-01`));
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
  const start = startOfMonth(parseISO(`${ym}-01`));
  const monthEnd = endOfMonth(start);
  const totalDays = eachDayOfInterval({ start, end: monthEnd }).length;
  const todayStart = startOfDay(today);
  if (todayStart < start) return 0;
  if (todayStart > monthEnd) return 1;
  const elapsed = eachDayOfInterval({ start, end: todayStart }).length;
  return elapsed / totalDays;
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
  basicUsed: number,
  specialUsed: number,
  settings: Settings,
  ym: string,
  today: Date,
): string[] {
  const tips: string[] = [];
  const totalBudget = settings.basicBudget + settings.specialBudget;
  const totalUsed = basicUsed + specialUsed;
  const progress = calendarProgress(ym, today);
  const expectedBasic = settings.basicBudget * progress;
  const planned = plannedBasicToDate(ym, today, settings);

  const basicRemain = settings.basicBudget - basicUsed;
  const specialRemain = settings.specialBudget - specialUsed;

  if (basicUsed > planned * 1.15 && planned > 0) {
    tips.push(`基础支出偏快：已用 ¥${basicUsed.toFixed(0)}，按日计划累计约 ¥${planned.toFixed(0)}。`);
  } else if (basicUsed < planned * 0.7 && planned > 50) {
    tips.push(`基础节奏良好：已用低于日计划累计，可适当放松。`);
  }

  if (basicUsed > expectedBasic * 1.2 && progress > 0.1) {
    tips.push(`相对日历进度，基础桶偏紧（进度 ${(progress * 100).toFixed(0)}%）。`);
  }

  if (specialUsed > settings.specialBudget * 0.9) {
    tips.push(`专项接近上限，剩余 ¥${specialRemain.toFixed(0)}。`);
  }

  if (totalUsed > totalBudget) {
    tips.push(`本月合计已超支 ¥${(totalUsed - totalBudget).toFixed(0)}，建议控制非必要消费。`);
  } else if (basicRemain < 200 && progress < 0.85) {
    tips.push(`基础剩余不多（¥${basicRemain.toFixed(0)}），月底前宜收紧吃饭与交通。`);
  }

  if (tips.length === 0) {
    tips.push(`节奏平稳：基础剩余 ¥${basicRemain.toFixed(0)}，专项剩余 ¥${specialRemain.toFixed(0)}。`);
  }

  if (!settings.includeSpecialInAdvice) {
    tips.push('当前建议已排除「特例」支出。');
  }

  return tips;
}

export function weekdayLabel(dateStr: string): string {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return `周${labels[getDay(parseISO(dateStr))]}`;
}

import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { EmptyState } from '../components/EmptyState';
import { GlassCard } from '../components/GlassCard';
import { IconEmptyDay } from '../components/CuteIcons';
import { ProgressBar } from '../components/ProgressBar';
import { TransactionItem } from '../components/TransactionItem';
import type { Store } from '../hooks/useStore';
import {
  dailyStatus,
  budgetStatus,
  dayNetBasic,
  expenseOnDate,
  dayTxCount,
  getDailyPlanAmount,
  getSatMode,
  isSpreadAc,
  monthBasicUsed,
  monthPaceSnapshot,
  monthSpecialUsed,
  weekdayLabel,
  type BudgetStatus,
} from '../utils/budget';
import { formatRmb } from '../utils/currency';
import { normalizeTxDate, parseLocalDate } from '../utils/dates';

interface Props {
  store: Store;
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function compactYuan(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? '-' : ''}${(abs / 1000).toFixed(1)}k`;
  if (abs >= 100) return n.toFixed(0);
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.05) return n.toFixed(0);
  return n.toFixed(1);
}

function statusClass(s: BudgetStatus): string {
  return `cal-status-${s}`;
}

export function CalendarPage({ store }: Props) {
  const { settings, transactions, categoryMap, walletMap, todayStr, currentYm, monthStats, setSatModeForDate } = store;
  const planOn = settings.dailyPlanCompareEnabled === true;
  const opts = { includeSpecial: settings.includeSpecialInAdvice };
  // Anchor "today" from local YYYY-MM-DD to avoid parseISO UTC off-by-one
  const today = parseLocalDate(todayStr);
  const pace = useMemo(() => monthPaceSnapshot(transactions, settings, currentYm, today, opts),
    [transactions, settings, currentYm, todayStr, opts.includeSpecial]);
  const hasBudget = settings.basicBudget > 0;
  const difference = planOn
    ? pace.basicPlanned - pace.basicUsed
    : settings.basicBudget - pace.basicUsed;
  const specialMonthUsed = monthSpecialUsed(transactions, settings, currentYm, { includeSpecial: true });

  const [cursor, setCursor] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

  const monthLabel = format(cursor, 'yyyy年M月');

  const days = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const leadBlank = getDay(startOfMonth(cursor));

  const dayStats = useMemo(() => {
    const map = new Map<
      string,
      { used: number; plan: number; remain: number; status: BudgetStatus; txCount: number }
    >();
    for (const d of days) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const used = dayNetBasic(transactions, dateStr, opts);
      const plan = getDailyPlanAmount(dateStr, settings);
      const remain = Math.round((plan - used) * 100) / 100;
      const status = planOn ? dailyStatus(Math.max(0, used), plan) : 'safe';
      const txCount = dayTxCount(transactions, dateStr);
      map.set(dateStr, { used, plan, remain, status, txCount });
    }
    return map;
    // monthStats.txCount forces recompute when any tx is added/removed
  }, [days, transactions, settings, opts.includeSpecial, planOn, monthStats.txCount, monthStats.todayUsed]);

  const selected = selectedDate ? normalizeTxDate(selectedDate) : null;
  const selectedStats = selected ? dayStats.get(selected) : undefined;
  const selectedTxs = useMemo(() => {
    if (!selected) return [];
    return transactions.filter((t) => normalizeTxDate(t.date) === selected);
  }, [transactions, selected]);
  const selectedAcAllocations = selected
    ? transactions
        .filter(isSpreadAc)
        .map((tx) => ({ tx, amount: expenseOnDate(tx, selected) }))
        .filter(({ amount }) => amount > 0)
    : [];
  const isSelectedSat = selected ? getDay(parseLocalDate(selected)) === 6 : false;
  const satMode = selected ? getSatMode(selected, settings) : settings.defaultSatMode;

  const monthSpend = monthBasicUsed(transactions, settings, currentYm, opts) + specialMonthUsed;

  return (
    <>
      <GlassCard title="基础生活 · 每日计划" className="cal-pace-card">
        {hasBudget ? (
          <>
            <p className="hint cal-pace-caption">{planOn ? `本月第 ${pace.elapsedDays}/${pace.totalDays} 天 · 按基础日计划核对` : '每日计划对照已关闭 · 显示基础生活月预算'}</p>
            <div className={`cal-pace-value ${difference < 0 ? 'is-over' : 'is-surplus'}`}>
              <span>{difference < 0 ? (planOn ? '超出计划' : '月预算超支') : (planOn ? '计划结余' : '月预算剩余')}</span>
              <strong>{formatRmb(Math.abs(difference))}</strong>
            </div>
            <p className="hint cal-pace-detail">
              基础生活已用 {formatRmb(pace.basicUsed)} / 月预算 {formatRmb(settings.basicBudget)}
            </p>
            {planOn && <p className="hint cal-pace-note">截至今天基础日计划累计 {formatRmb(pace.basicPlanned)}；专项支出不计入每日计划。</p>}
          </>
        ) : <p className="hint">设置基础生活月预算后，这里会显示基础预算使用情况。</p>}
      </GlassCard>
      <GlassCard title="专项支出 · 本月额度" className="cal-pace-card">
        {settings.specialBudget > 0 ? (
          <>
            <p className="hint cal-pace-caption">整月额度独立统计，不分摊到每日预算</p>
            <ProgressBar
              label="1500 专项"
              used={specialMonthUsed}
              budget={settings.specialBudget}
              status={budgetStatus(specialMonthUsed, settings.specialBudget)}
            />
          </>
        ) : <p className="hint">在预算设置中填写专项月额度后，这里会单独显示使用进度。</p>}
      </GlassCard>
      <GlassCard
        title="日历"
        action={
          <div className="cal-nav">
            <button
              type="button"
              className="btn-icon cal-nav-btn"
              aria-label="上个月"
              onClick={() => setCursor((c) => subMonths(c, 1))}
            >
              ‹
            </button>
            <span className="cal-month-label">{monthLabel}</span>
            <button
              type="button"
              className="btn-icon cal-nav-btn"
              aria-label="下个月"
              onClick={() => setCursor((c) => addMonths(c, 1))}
            >
              ›
            </button>
          </div>
        }
      >
        <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
          {planOn
            ? `每日只对照基础生活计划；专项只在月度额度中按实际金额累计 · 本月记账合计 ${formatRmb(monthSpend)}`
            : `每日只显示基础生活支出 · 专项在月度额度单独累计 · 本月记账合计 ${formatRmb(monthSpend)}（计划对照已关）`}
        </p>

        <div className="cal-weekdays" aria-hidden>
          {WEEK_LABELS.map((w) => (
            <div key={w} className="cal-weekday">
              {w}
            </div>
          ))}
        </div>

        <div className="cal-grid" role="grid" aria-label={`${monthLabel}日历`}>
          {Array.from({ length: leadBlank }).map((_, i) => (
            <div key={`pad-${i}`} className="cal-cell cal-pad" />
          ))}
          {days.map((d) => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const stat = dayStats.get(dateStr)!;
            const dateKey = dateStr;
            const isToday = dateKey === todayStr;
            const isFuture = dateKey > todayStr;
            const isSel = selected === dateKey;
            const showNums = !isFuture || stat.used !== 0 || stat.txCount > 0;
            return (
              <button
                key={dateStr}
                type="button"
                role="gridcell"
                className={[
                  'cal-cell',
                  planOn ? statusClass(stat.status) : 'cal-status-neutral',
                  isToday ? 'is-today' : '',
                  isFuture ? 'is-future' : '',
                  isSel ? 'is-selected' : '',
                  !isSameMonth(d, cursor) ? 'is-other' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedDate(dateStr)}
                aria-label={
                  planOn
                    ? `${dateStr} 基础净支出${stat.used} 基础计划剩余${stat.remain}`
                    : `${dateStr} 基础净支出${stat.used}`
                }
                aria-selected={isSel}
              >
                <span className="cal-daynum">{format(d, 'd')}</span>
                {showNums ? (
                  <>
                    <span className="cal-spend">基{compactYuan(stat.used)}</span>
                    {planOn && (
                      <span className={`cal-remain ${stat.remain >= 0 ? 'pos' : 'neg'}`}>
                        {stat.remain >= 0
                          ? `余${compactYuan(stat.remain)}`
                          : `超${compactYuan(-stat.remain)}`}
                      </span>
                    )}
                  </>
                ) : planOn ? (
                  <span className="cal-plan-hint">{compactYuan(stat.plan)}</span>
                ) : (
                  <span className="cal-plan-hint">—</span>
                )}
              </button>
            );
          })}
        </div>

        {planOn && (
          <div className="cal-legend section-gap">
            <span className="cal-leg cal-status-safe">安全</span>
            <span className="cal-leg cal-status-near">临近</span>
            <span className="cal-leg cal-status-over">超支</span>
            <span className="cal-leg cal-status-severe">严重</span>
          </div>
        )}
      </GlassCard>

      {selected && selectedStats && (
        <GlassCard title={`${weekdayLabel(selected)} · ${format(parseLocalDate(selected), 'M月d日')}`}>
          {planOn ? (
            <ProgressBar
              label="当日基础 vs 计划"
              used={Math.max(0, selectedStats.used)}
              budget={selectedStats.plan}
              status={selectedStats.status}
              extra={
                selectedStats.used < 0
                  ? `含收入抵扣后净额 ${formatRmb(selectedStats.used)}`
                  : undefined
              }
            />
          ) : null}
          <div className={`stat-grid ${planOn ? 'section-gap' : ''}`}>
            <div className="stat-pill">
              <div className="k">当日基础净支出</div>
              <div className="v">{formatRmb(selectedStats.used)}</div>
            </div>
            {planOn ? (
              <div className="stat-pill">
                <div className="k">{selectedStats.remain >= 0 ? '剩余额度' : '超支金额'}</div>
                <div
                  className="v"
                  style={{
                    color: selectedStats.remain >= 0 ? 'var(--green-600)' : 'var(--red-500)',
                  }}
                >
                  {formatRmb(Math.abs(selectedStats.remain))}
                </div>
              </div>
            ) : (
              <div className="stat-pill">
                <div className="k">流水笔数</div>
                <div className="v">{selectedTxs.length}</div>
              </div>
            )}
          </div>
          <p className="hint section-gap">此处每日金额仅反映基础生活支出；专项金额计入上方的月度额度。</p>

          {planOn && isSelectedSat && (
            <div className="section-gap">
              <p className="hint" style={{ marginBottom: 8 }}>
                周六模式（影响当日计划）
              </p>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${satMode === 'play' ? 'active' : ''}`}
                  onClick={() => setSatModeForDate(selected, 'play')}
                >
                  出去玩 · {settings.dailyPlan.satPlay}
                </button>
                <button
                  type="button"
                  className={`chip ${satMode === 'stay' ? 'active' : ''}`}
                  onClick={() => setSatModeForDate(selected, 'stay')}
                >
                  不玩 · {settings.dailyPlan.satStay}
                </button>
              </div>
            </div>
          )}

          {selectedAcAllocations.length > 0 && (
            <div className="grocery-summary-pill section-gap">
              <strong>当日空调分摊</strong>
              {selectedAcAllocations.map(({ tx, amount }) => (
                <p className="hint" key={tx.id} style={{ margin: '4px 0 0' }}>
                  {tx.date} 记录的空调费用 · 今日计入 {formatRmb(amount)}
                </p>
              ))}
            </div>
          )}
          <h3 className="cal-detail-title">当日流水</h3>
          {selectedTxs.length === 0 ? (
            <EmptyState icon={<IconEmptyDay />} title="这天没有新流水" hint={selectedAcAllocations.length ? '上方已计入空调日分摊' : '可去「记账」补一笔'} />
          ) : (
            <ul className="tx-list">
              {selectedTxs.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  tx={tx}
                  category={categoryMap.get(tx.categoryId)}
                  wallet={tx.walletId ? walletMap.get(tx.walletId) : undefined}
                />
              ))}
            </ul>
          )}
        </GlassCard>
      )}
    </>
  );
}

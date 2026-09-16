import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
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
  dayNetBasic,
  getDailyPlanAmount,
  getSatMode,
  weekdayLabel,
  type BudgetStatus,
} from '../utils/budget';
import { formatRmb } from '../utils/currency';

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
  const { settings, transactions, categoryMap, walletMap, todayStr, setSatModeForDate } = store;
  const planOn = settings.dailyPlanCompareEnabled !== false;
  const opts = { includeSpecial: settings.includeSpecialInAdvice };
  const today = parseISO(todayStr);

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
      const txCount = transactions.filter((t) => t.date === dateStr).length;
      map.set(dateStr, { used, plan, remain, status, txCount });
    }
    return map;
  }, [days, transactions, settings, opts.includeSpecial, planOn]);

  const selected = selectedDate;
  const selectedStats = selected ? dayStats.get(selected) : undefined;
  const selectedTxs = useMemo(() => {
    if (!selected) return [];
    return transactions.filter((t) => t.date === selected);
  }, [transactions, selected]);

  const isSelectedSat = selected ? getDay(parseISO(selected)) === 6 : false;
  const satMode = selected ? getSatMode(selected, settings) : settings.defaultSatMode;

  const monthSpend = useMemo(() => {
    let sum = 0;
    for (const d of days) {
      const dateStr = format(d, 'yyyy-MM-dd');
      sum += dayNetBasic(transactions, dateStr, opts);
    }
    return Math.round(sum * 100) / 100;
  }, [days, transactions, opts.includeSpecial]);

  return (
    <>
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
            ? `每日基础净支出与相对日计划余缺 · 本月净支出 ${formatRmb(monthSpend)}`
            : `每日基础净支出 · 本月净支出 ${formatRmb(monthSpend)}（计划对照已关）`}
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
            const isToday = isSameDay(d, today);
            const isFuture = d > today;
            const isSel = selected === dateStr;
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
                    ? `${dateStr} 支出${stat.used} 剩余${stat.remain}`
                    : `${dateStr} 支出${stat.used}`
                }
                aria-selected={isSel}
              >
                <span className="cal-daynum">{format(d, 'd')}</span>
                {showNums ? (
                  <>
                    <span className="cal-spend">{compactYuan(stat.used)}</span>
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
        <GlassCard title={`${weekdayLabel(selected)} · ${format(parseISO(selected), 'M月d日')}`}>
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
              <div className="k">当日净支出</div>
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

          <h3 className="cal-detail-title">当日流水</h3>
          {selectedTxs.length === 0 ? (
            <EmptyState icon={<IconEmptyDay />} title="这天还没有记录" hint="可去「记账」补一笔" />
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

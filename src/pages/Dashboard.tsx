import { format } from 'date-fns';
import { AdviceFlowCard } from '../components/AdviceFlowCard';
import { EmptyState } from '../components/EmptyState';
import { IconEmptyLedger, IconEmptySpend } from '../components/CuteIcons';
import { GlassCard } from '../components/GlassCard';
import { ProgressBar } from '../components/ProgressBar';
import { TransactionItem } from '../components/TransactionItem';
import type { Store } from '../hooks/useStore';
import {
  budgetStatus,
  buildAdvice,
  dailyStatus,
  filterMonth,
  getSatMode,
  weekdayLabel,
} from '../utils/budget';
import { formatRmb } from '../utils/currency';

interface Props {
  store: Store;
  onOpenTx: (id: string) => void;
  adviceAnimated?: boolean;
}

export function Dashboard({ store, onOpenTx, adviceAnimated = true }: Props) {
  const { settings, transactions, categoryMap, walletMap, todayStr, currentYm, monthStats, setSatModeForDate } = store;
  const planOn = settings.dailyPlanCompareEnabled === true;
  const budgetsSet = (settings.basicBudget ?? 0) > 0 || (settings.specialBudget ?? 0) > 0;
  const planUseful = planOn && (settings.dailyPlan
    ? Object.values(settings.dailyPlan).some((v) => typeof v === 'number' && v > 0)
    : false);
  const opts = { includeSpecial: settings.includeSpecialInAdvice };
  const monthTxs = filterMonth(transactions, currentYm);
  const { basicUsed, specialUsed, totalBudget, totalUsed, totalRemain, todayUsed, todayPlan } = monthStats;
  const isSat = new Date().getDay() === 6;
  const satMode = getSatMode(todayStr, settings);
  const advice = planUseful && budgetsSet
    ? buildAdvice(basicUsed, specialUsed, settings, currentYm, new Date())
    : budgetsSet
      ? [
          `本月基础净支出 ${formatRmb(basicUsed)}，专项 ${formatRmb(specialUsed)}，合计 ${formatRmb(totalUsed)}。`,
          planOn
            ? '日计划额度仍为 0，可在设置中填写每日计划后再对照。'
            : '已关闭「计划生活费每天支出对照」，此处仅作简单汇总。',
        ]
      : [
          '尚未设置月预算。可在「记账」顶栏或设置中填写基础/专项预算。',
          '当前为空白账本：记一笔后这里会显示本月汇总。',
        ];

  const recent = [...transactions].slice(0, 8);

  const catSummary = (() => {
    const map = new Map<string, number>();
    for (const t of monthTxs) {
      if (t.type !== 'expense' || t.kind === 'topup') continue;
      if (!opts.includeSpecial && t.isSpecial) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amountRmb);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  })();

  return (
    <>
      <AdviceFlowCard
        title={planUseful && budgetsSet ? '节奏建议' : '本月概览'}
        items={advice}
        animated={adviceAnimated}
      />

      <GlassCard title={`今日 · ${weekdayLabel(todayStr)} ${format(new Date(), 'M/d')}`}>
        {planUseful ? (
          <ProgressBar
            label="今日基础 vs 计划"
            used={Math.max(0, todayUsed)}
            budget={todayPlan}
            status={dailyStatus(Math.max(0, todayUsed), todayPlan)}
            extra={todayUsed < 0 ? `含收入抵扣后净额 ${formatRmb(todayUsed)}` : undefined}
          />
        ) : null}
        <div className={`stat-grid ${planUseful ? 'section-gap' : ''}`}>
          <div className="stat-pill">
            <div className="k">今日净支出</div>
            <div className="v">{formatRmb(todayUsed)}</div>
          </div>
          {planUseful ? (
            <div className="stat-pill">
              <div className="k">今日计划</div>
              <div className="v">{formatRmb(todayPlan)}</div>
            </div>
          ) : (
            <div className="stat-pill">
              <div className="k">本月合计</div>
              <div className="v">{formatRmb(totalUsed)}</div>
            </div>
          )}
        </div>
        {planUseful && isSat && (
          <div className="section-gap">
            <p className="hint" style={{ marginBottom: 8 }}>
              周六模式（影响今日计划）
            </p>
            <div className="chip-row">
              <button
                type="button"
                className={`chip ${satMode === 'play' ? 'active' : ''}`}
                onClick={() => setSatModeForDate(todayStr, 'play')}
              >
                出去玩 · {settings.dailyPlan.satPlay}
              </button>
              <button
                type="button"
                className={`chip ${satMode === 'stay' ? 'active' : ''}`}
                onClick={() => setSatModeForDate(todayStr, 'stay')}
              >
                不玩 · {settings.dailyPlan.satStay}
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title={budgetsSet ? (planUseful ? '本月预算' : '本月汇总') : '本月汇总'}>
        {budgetsSet && settings.showMonthlyBudgetProgress !== false && (
          <div className="month-budget-hero">
            <ProgressBar
              label="本月合计 vs 预算"
              used={Math.max(0, totalUsed)}
              budget={totalBudget}
              status={budgetStatus(totalUsed, totalBudget)}
              extra={
                totalUsed < 0
                  ? `含收入抵扣后净额 ${formatRmb(totalUsed)}`
                  : undefined
              }
            />
            <div className="stat-grid section-gap">
              <div className="stat-pill">
                <div className="k">本月已用</div>
                <div className="v">{formatRmb(totalUsed)}</div>
              </div>
              <div className="stat-pill">
                <div className="k">本月剩余</div>
                <div
                  className="v"
                  style={{
                    color: totalRemain < 0 ? 'var(--red-500)' : undefined,
                  }}
                >
                  {formatRmb(totalRemain)}
                </div>
              </div>
            </div>
          </div>
        )}
        {!budgetsSet && (
          <p className="hint" style={{ marginTop: 0 }}>
            预算未设置 · 仅显示实际净支出。可在「记账」顶栏填写基础/专项预算。
          </p>
        )}
        {planUseful && budgetsSet ? (
          <>
            <ProgressBar
              label={`基础生活 ${settings.basicBudget}`}
              used={basicUsed}
              budget={settings.basicBudget}
              status={budgetStatus(basicUsed, settings.basicBudget)}
            />
            <ProgressBar
              label={`专项 ${settings.specialBudget}`}
              used={specialUsed}
              budget={settings.specialBudget}
              status={budgetStatus(specialUsed, settings.specialBudget)}
            />
            {settings.showMonthlyBudgetProgress === false && (
              <ProgressBar
                label={`合计 ${totalBudget}`}
                used={totalUsed}
                budget={totalBudget}
                status={budgetStatus(totalUsed, totalBudget)}
              />
            )}
            <div className="toggle-row section-gap">
              <span style={{ fontSize: '0.85rem' }}>建议含特例（请客）</span>
              <button
                type="button"
                className={`toggle ${settings.includeSpecialInAdvice ? 'on' : ''}`}
                aria-label="切换是否含特例"
                onClick={() =>
                  store.updateSettings({ includeSpecialInAdvice: !settings.includeSpecialInAdvice })
                }
              />
            </div>
          </>
        ) : (
          <div className="stat-grid">
            <div className="stat-pill">
              <div className="k">基础净支出</div>
              <div className="v">{formatRmb(basicUsed)}</div>
            </div>
            <div className="stat-pill">
              <div className="k">专项净支出</div>
              <div className="v">{formatRmb(specialUsed)}</div>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title="分类汇总（本月支出）">
        {catSummary.length === 0 ? (
          <EmptyState icon={<IconEmptySpend />} title="暂无支出" hint="记一笔后这里会汇总分类" />
        ) : (
          <ul className="tx-list">
            {catSummary.map(([id, amt]) => {
              const c = categoryMap.get(id);
              return (
                <li key={id} className="tx-item" style={{ cursor: 'default' }}>
                  <div className="tx-icon">
                    <span className="emoji-bubble">{c?.icon ?? '📦'}</span>
                  </div>
                  <div className="tx-body">
                    <div className="title">{c?.name ?? id}</div>
                    <div className="meta">{c?.bucket === 'special' ? '专项' : '基础'}</div>
                  </div>
                  <div className="tx-amount expense">{formatRmb(amt)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      <GlassCard title="最近流水">
        {recent.length === 0 ? (
          <EmptyState icon={<IconEmptyLedger />} title="还没有记录" hint="用底部「记账」开始" />
        ) : (
          <ul className="tx-list">
            {recent.map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                category={categoryMap.get(tx.categoryId)}
                wallet={tx.walletId ? walletMap.get(tx.walletId) : undefined}
                onClick={() => onOpenTx(tx.id)}
              />
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}

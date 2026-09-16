import { format } from 'date-fns';
import { GlassCard } from '../components/GlassCard';
import { ProgressBar } from '../components/ProgressBar';
import { TransactionItem } from '../components/TransactionItem';
import type { Store } from '../hooks/useStore';
import {
  budgetStatus,
  buildAdvice,
  dailyStatus,
  dayNetBasic,
  filterMonth,
  getDailyPlanAmount,
  getSatMode,
  netBasicSpend,
  specialSpend,
  weekdayLabel,
} from '../utils/budget';
import { formatRmb } from '../utils/currency';

interface Props {
  store: Store;
  onAdd: () => void;
  onOpenTx: (id: string) => void;
}

export function Dashboard({ store, onAdd, onOpenTx }: Props) {
  const { settings, transactions, categoryMap, todayStr, currentYm, setSatModeForDate } = store;
  const opts = { includeSpecial: settings.includeSpecialInAdvice };
  const monthTxs = filterMonth(transactions, currentYm);
  const basicUsed = netBasicSpend(monthTxs, opts);
  const specialUsed = specialSpend(monthTxs, opts);
  const totalBudget = settings.basicBudget + settings.specialBudget;
  const totalUsed = basicUsed + specialUsed;

  const todayUsed = dayNetBasic(transactions, todayStr, opts);
  const todayPlan = getDailyPlanAmount(todayStr, settings);
  const isSat = new Date().getDay() === 6;
  const satMode = getSatMode(todayStr, settings);
  const advice = buildAdvice(basicUsed, specialUsed, settings, currentYm, new Date());

  const recent = [...transactions]
    .filter((t) => t.kind !== 'topup' || true)
    .slice(0, 8);

  const catSummary = (() => {
    const map = new Map<string, number>();
    for (const t of monthTxs) {
      if (t.type !== 'expense' || t.kind === 'topup') continue;
      if (!opts.includeSpecial && t.isSpecial) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amountRmb);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  })();

  return (
    <>
      <GlassCard title={`今日 · ${weekdayLabel(todayStr)} ${format(new Date(), 'M/d')}`}>
        <ProgressBar
          label="今日基础 vs 计划"
          used={Math.max(0, todayUsed)}
          budget={todayPlan}
          status={dailyStatus(Math.max(0, todayUsed), todayPlan)}
          extra={todayUsed < 0 ? `含收入抵扣后净额 ${formatRmb(todayUsed)}` : undefined}
        />
        <div className="stat-grid section-gap">
          <div className="stat-pill">
            <div className="k">今日净支出</div>
            <div className="v">{formatRmb(todayUsed)}</div>
          </div>
          <div className="stat-pill">
            <div className="k">今日计划</div>
            <div className="v">{formatRmb(todayPlan)}</div>
          </div>
        </div>
        {isSat && (
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
        <button type="button" className="btn btn-primary btn-block section-gap" onClick={onAdd}>
          记一笔
        </button>
      </GlassCard>

      <GlassCard title="本月预算">
        <ProgressBar
          label="基础生活 3500"
          used={basicUsed}
          budget={settings.basicBudget}
          status={budgetStatus(basicUsed, settings.basicBudget)}
        />
        <ProgressBar
          label="专项 1500"
          used={specialUsed}
          budget={settings.specialBudget}
          status={budgetStatus(specialUsed, settings.specialBudget)}
        />
        <ProgressBar
          label="合计 5000"
          used={totalUsed}
          budget={totalBudget}
          status={budgetStatus(totalUsed, totalBudget)}
        />
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
      </GlassCard>

      <GlassCard title="节奏建议">
        <ul className="advice-list">
          {advice.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard title="分类汇总（本月支出）">
        {catSummary.length === 0 ? (
          <p className="empty">暂无支出</p>
        ) : (
          <ul className="tx-list">
            {catSummary.map(([id, amt]) => {
              const c = categoryMap.get(id);
              return (
                <li key={id} className="tx-item" style={{ cursor: 'default' }}>
                  <div className="tx-icon">{c?.icon ?? '📦'}</div>
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
          <p className="empty">还没有记录，点上方「记一笔」开始</p>
        ) : (
          <ul className="tx-list">
            {recent.map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                category={categoryMap.get(tx.categoryId)}
                onClick={() => onOpenTx(tx.id)}
              />
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { EmptyState } from '../components/EmptyState';
import { IconEmptyLedger } from '../components/CuteIcons';
import { GlassCard } from '../components/GlassCard';
import { ModalPortal } from '../components/ModalPortal';
import { EditTransactionSheet } from '../components/EditTransactionSheet';
import { TransactionItem } from '../components/TransactionItem';
import type { Store } from '../hooks/useStore';
import type { PaymentMethod, Transaction } from '../types';
import { filterMonth, weekdayLabel } from '../utils/budget';
import { formatMoney, formatRmb } from '../utils/currency';
import { normalizeTxDate, parseLocalDate } from '../utils/dates';
import { PAYMENT_LABEL, PAYMENT_OPTIONS } from '../utils/payment';

interface Props {
  store: Store;
}

const TYPE_LABEL = {
  all: '全部',
  expense: '支出',
  income: '收入',
} as const;

function sortTxs(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    const da = normalizeTxDate(a.date);
    const db = normalizeTxDate(b.date);
    if (da !== db) return db.localeCompare(da);
    const ca = a.createdAt ?? '';
    const cb = b.createdAt ?? '';
    if (ca !== cb) return cb.localeCompare(ca);
    return b.id.localeCompare(a.id);
  });
}

function groupByDay(txs: Transaction[]): { date: string; items: Transaction[]; daySpend: number }[] {
  const sorted = sortTxs(txs);
  const order: string[] = [];
  const map = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    const d = normalizeTxDate(tx.date);
    if (!map.has(d)) {
      map.set(d, []);
      order.push(d);
    }
    map.get(d)!.push(tx);
  }
  return order.map((date) => {
    const items = map.get(date)!;
    const daySpend = items
      .filter((t) => t.type === 'expense' && t.kind !== 'topup')
      .reduce((a, t) => a + t.amountRmb, 0);
    return { date, items, daySpend };
  });
}

function dayHeaderLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${format(d, 'M月d日')} · ${weekdayLabel(dateStr)}`;
}

export function TransactionList({ store }: Props) {
  const { transactions, categoryMap, walletMap, wallets, categories, currentYm, deleteTransaction } = store;
  const [ym, setYm] = useState(currentYm);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [payFilter, setPayFilter] = useState<PaymentMethod | 'all'>('all');
  /** all | basic living | special | wallet:<id> */
  const [partFilter, setPartFilter] = useState<'all' | 'basic' | 'special' | `wallet:${string}`>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const list = useMemo(() => {
    let txs = filterMonth(transactions, ym);
    if (filter === 'expense') txs = txs.filter((t) => t.type === 'expense' && t.kind !== 'topup');
    if (filter === 'income') txs = txs.filter((t) => t.type === 'income');
    if (payFilter !== 'all') txs = txs.filter((t) => t.paymentMethod === payFilter);
    if (partFilter === 'basic') {
      txs = txs.filter(
        (t) => t.type === 'expense' && t.kind !== 'topup' && t.bucket === 'basic' && !t.isSpecial,
      );
    } else if (partFilter === 'special') {
      txs = txs.filter(
        (t) =>
          t.type === 'expense' &&
          t.kind !== 'topup' &&
          (t.bucket === 'special' || !!t.isSpecial),
      );
    } else if (partFilter.startsWith('wallet:')) {
      const wid = partFilter.slice('wallet:'.length);
      txs = txs.filter((t) => t.walletId === wid);
    }
    return txs;
  }, [transactions, ym, filter, payFilter, partFilter]);

  const dayGroups = useMemo(() => groupByDay(list), [list]);

  const sumExpense = list
    .filter((t) => t.type === 'expense' && t.kind !== 'topup')
    .reduce((a, t) => a + t.amountRmb, 0);
  const sumIncome = list.filter((t) => t.type === 'income').reduce((a, t) => a + t.amountRmb, 0);

  const partLabel =
    partFilter === 'all'
      ? '分区不限'
      : partFilter === 'basic'
        ? '基础生活'
        : partFilter === 'special'
          ? '专项'
          : walletMap.get(partFilter.slice('wallet:'.length))?.name ?? '荷包';

  const filterActive = filter !== 'all' || payFilter !== 'all' || partFilter !== 'all';
  const filterSummary = [
    TYPE_LABEL[filter],
    payFilter === 'all' ? '支付不限' : PAYMENT_LABEL[payFilter],
    partLabel,
  ].join(' · ');

  const closeFilterSheet = () => setFilterOpen(false);

  return (
    <>
      <GlassCard title="流水明细">
        <div className="field">
          <label>月份</label>
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
        </div>
        <div className="tx-filter-bar">
          <button
            type="button"
            className={`tx-filter-btn ${filterActive ? 'has-filter' : ''}`}
            onClick={() => setFilterOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
          >
            <span className="tx-filter-btn-label">筛选</span>
            <span className="tx-filter-btn-summary">{filterSummary}</span>
            {filterActive && <span className="tx-filter-badge" aria-hidden />}
          </button>
        </div>
        <div className="stat-grid" style={{ marginBottom: 12 }}>
          <div className="stat-pill">
            <div className="k">支出合计</div>
            <div className="v" style={{ color: 'var(--red-500)' }}>
              {formatRmb(sumExpense)}
            </div>
          </div>
          <div className="stat-pill">
            <div className="k">收入合计</div>
            <div className="v" style={{ color: 'var(--green-600)' }}>
              {formatRmb(sumIncome)}
            </div>
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<IconEmptyLedger />} title="本月暂无记录" hint="换个月份，或去记账补一笔" />
        ) : (
          <ul className="tx-list">
            {dayGroups.map((group) => (
              <li key={group.date} className="tx-day-group">
                <div className="tx-day-header">
                  <span className="tx-day-title">{dayHeaderLabel(group.date)}</span>
                  <span className="tx-day-meta">支出 {formatRmb(group.daySpend)}</span>
                </div>
                <ul className="tx-day-items">
                  {group.items.map((tx) => (
                    <TransactionItem
                      key={tx.id}
                      tx={tx}
                      category={categoryMap.get(tx.categoryId)}
                      wallet={tx.walletId ? walletMap.get(tx.walletId) : undefined}
                      onClick={() => setSelected(tx)}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {filterOpen && (
        <ModalPortal>
        <div className="modal-backdrop" onClick={closeFilterSheet} role="presentation">
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="筛选流水"
          >
            <div className="modal-handle" />
            <h2 className="glass-title">筛选</h2>
            <div className="modal-sheet-body">
            <section className="tx-filter-section">
              <p className="sheet-section-label tx-filter-section-title">收支</p>
              <div className="chip-row">
                {(
                  [
                    ['all', '全部'],
                    ['expense', '支出'],
                    ['income', '收入'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`chip ${filter === k ? 'active' : ''}`}
                    onClick={() => setFilter(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="tx-filter-section section-gap">
              <p className="sheet-section-label tx-filter-section-title">支付方式</p>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${payFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setPayFilter('all')}
                >
                  支付不限
                </button>
                {PAYMENT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`chip ${payFilter === o.id ? 'active' : ''}`}
                    onClick={() => setPayFilter(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="tx-filter-section section-gap">
              <p className="sheet-section-label tx-filter-section-title">预算分区</p>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${partFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setPartFilter('all')}
                >
                  分区不限
                </button>
                <button
                  type="button"
                  className={`chip ${partFilter === 'basic' ? 'active' : ''}`}
                  onClick={() => setPartFilter('basic')}
                >
                  基础生活支出
                </button>
                <button
                  type="button"
                  className={`chip ${partFilter === 'special' ? 'active' : ''}`}
                  onClick={() => setPartFilter('special')}
                >
                  专项支出
                </button>
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`chip chip-with-icon ${partFilter === `wallet:${w.id}` ? 'active' : ''}`}
                    onClick={() => setPartFilter(`wallet:${w.id}`)}
                  >
                    <span
                      className="wallet-chip-dot"
                      style={{ background: w.color }}
                      aria-hidden
                    />
                    {w.name}
                  </button>
                ))}
              </div>
            </section>
            </div>
            <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={closeFilterSheet}
            >
              完成
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={closeFilterSheet}
            >
              退出
            </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {selected && (
        <ModalPortal>
        <div className="modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-handle" />
            <h2 className="glass-title">记录详情</h2>
            <div className="modal-sheet-body">
            <p style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700 }}>
              {categories.find((c) => c.id === selected.categoryId)?.icon}{' '}
              {categories.find((c) => c.id === selected.categoryId)?.name}
            </p>
            <p className="hint">
              {selected.date} · {selected.bucket === 'special' ? '专项' : '基础'}
              {selected.isSpecial ? ' · 请客特例' : ''}
              {selected.isMonthly ? ' · 月度支出' : ''}
              {selected.kind === 'topup' ? ' · 充值不计支出' : ''}
              {selected.paymentMethod !== 'none' ? ` · ${PAYMENT_LABEL[selected.paymentMethod]}` : ''}
            </p>
            <p style={{ fontSize: '1.4rem', fontWeight: 750, margin: '12px 0' }}>
              {selected.type === 'income' ? '+' : selected.kind === 'topup' ? '' : '-'}
              {formatRmb(selected.amountRmb)}
            </p>
            {selected.currency !== 'RMB' && (
              <p className="hint">
                原币 {formatMoney(selected.amount, selected.currency)} × {selected.rate}
              </p>
            )}
            {selected.pantryCostRmb != null && selected.pantryCostRmb > 0 && (
              <p className="hint">库存均摊约 {formatRmb(selected.pantryCostRmb)}</p>
            )}
            {selected.isGroceryPurchase && <p className="hint">买菜购置（已入冰箱）</p>}
            {selected.note && <p style={{ marginTop: 8 }}>备注：{selected.note}</p>}
            </div>
            <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                setEditing(selected);
                setSelected(null);
              }}
            >
              编辑
            </button>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() => {
                deleteTransaction(selected.id);
                setSelected(null);
              }}
            >
              删除
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setSelected(null)}
            >
              退出
            </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {editing && (
        <EditTransactionSheet
          key={editing.id}
          tx={editing}
          store={store}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

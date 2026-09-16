import { useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { IconEmptyLedger } from '../components/CuteIcons';
import { GlassCard } from '../components/GlassCard';
import { TransactionItem } from '../components/TransactionItem';
import type { Store } from '../hooks/useStore';
import type { PaymentMethod, Transaction } from '../types';
import { filterMonth } from '../utils/budget';
import { formatMoney, formatRmb } from '../utils/currency';
import { PAYMENT_LABEL, PAYMENT_OPTIONS } from '../utils/payment';

interface Props {
  store: Store;
}

const TYPE_LABEL = {
  all: '全部',
  expense: '支出',
  income: '收入',
} as const;

export function TransactionList({ store }: Props) {
  const { transactions, categoryMap, walletMap, categories, currentYm, deleteTransaction } = store;
  const [ym, setYm] = useState(currentYm);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [payFilter, setPayFilter] = useState<PaymentMethod | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const list = useMemo(() => {
    let txs = filterMonth(transactions, ym);
    if (filter === 'expense') txs = txs.filter((t) => t.type === 'expense' && t.kind !== 'topup');
    if (filter === 'income') txs = txs.filter((t) => t.type === 'income');
    if (payFilter !== 'all') txs = txs.filter((t) => t.paymentMethod === payFilter);
    return txs;
  }, [transactions, ym, filter, payFilter]);

  const sumExpense = list
    .filter((t) => t.type === 'expense' && t.kind !== 'topup')
    .reduce((a, t) => a + t.amountRmb, 0);
  const sumIncome = list.filter((t) => t.type === 'income').reduce((a, t) => a + t.amountRmb, 0);

  const filterActive = filter !== 'all' || payFilter !== 'all';
  const filterSummary = [
    TYPE_LABEL[filter],
    payFilter === 'all' ? '支付不限' : PAYMENT_LABEL[payFilter],
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
            {list.map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                category={categoryMap.get(tx.categoryId)}
                wallet={tx.walletId ? walletMap.get(tx.walletId) : undefined}
                onClick={() => setSelected(tx)}
              />
            ))}
          </ul>
        )}
      </GlassCard>

      {filterOpen && (
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

            <button
              type="button"
              className="btn btn-primary btn-block section-gap"
              onClick={closeFilterSheet}
            >
              完成
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-handle" />
            <h2 className="glass-title">记录详情</h2>
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
            {selected.note && <p style={{ marginTop: 8 }}>备注：{selected.note}</p>}
            <button
              type="button"
              className="btn btn-danger btn-block section-gap"
              onClick={() => {
                deleteTransaction(selected.id);
                setSelected(null);
              }}
            >
              删除
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block section-gap"
              onClick={() => setSelected(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}

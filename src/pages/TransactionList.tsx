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

export function TransactionList({ store }: Props) {
  const { transactions, categoryMap, categories, currentYm, deleteTransaction } = store;
  const [ym, setYm] = useState(currentYm);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'topup'>('all');
  const [payFilter, setPayFilter] = useState<PaymentMethod | 'all'>('all');
  const [selected, setSelected] = useState<Transaction | null>(null);

  const list = useMemo(() => {
    let txs = filterMonth(transactions, ym);
    if (filter === 'expense') txs = txs.filter((t) => t.type === 'expense' && t.kind !== 'topup');
    if (filter === 'income') txs = txs.filter((t) => t.type === 'income');
    if (filter === 'topup') txs = txs.filter((t) => t.kind === 'topup');
    if (payFilter !== 'all') txs = txs.filter((t) => t.paymentMethod === payFilter);
    return txs;
  }, [transactions, ym, filter, payFilter]);

  const sumExpense = list
    .filter((t) => t.type === 'expense' && t.kind !== 'topup')
    .reduce((a, t) => a + t.amountRmb, 0);
  const sumIncome = list.filter((t) => t.type === 'income').reduce((a, t) => a + t.amountRmb, 0);

  return (
    <>
      <GlassCard title="流水明细">
        <div className="field">
          <label>月份</label>
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
        </div>
        <div className="chip-row" style={{ marginBottom: 8 }}>
          {(
            [
              ['all', '全部'],
              ['expense', '支出'],
              ['income', '收入'],
              ['topup', '充值'],
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
        <div className="chip-row" style={{ marginBottom: 12 }}>
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
                onClick={() => setSelected(tx)}
              />
            ))}
          </ul>
        )}
      </GlassCard>

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
              {selected.kind === 'topup' ? ' · 充值不计支出' : ''}
              {selected.paymentMethod !== 'none'
                ? ` · ${PAYMENT_LABEL[selected.paymentMethod]}`
                : ''}
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

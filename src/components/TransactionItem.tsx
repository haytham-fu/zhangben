import type { Category, Transaction, Wallet } from '../types';
import { formatMoney, formatRmb } from '../utils/currency';
import { PAYMENT_LABEL, paymentBadgeClass } from '../utils/payment';

interface Props {
  tx: Transaction;
  category?: Category;
  wallet?: Wallet;
  onClick?: () => void;
}

export function TransactionItem({ tx, category, wallet, onClick }: Props) {
  const isTopup = tx.kind === 'topup';
  const amountClass = isTopup ? 'topup' : tx.type === 'income' ? 'income' : 'expense';
  const sign = isTopup ? '' : tx.type === 'income' ? '+' : '-';
  const title = category?.name ?? '未分类';
  const payLabel = tx.paymentMethod !== 'none' ? PAYMENT_LABEL[tx.paymentMethod] : '';

  return (
    <li>
      <button type="button" className="tx-item" onClick={onClick} style={{ width: '100%', textAlign: 'left' }}>
        <div className="tx-icon">{category?.icon ?? '📝'}</div>
        <div className="tx-body">
          <div className="title">
            {title}
            {tx.isSpecial && <span className="badge badge-special">请客</span>}
            {isTopup && <span className="badge badge-topup">充值·不计支出</span>}
            {payLabel && !isTopup && (
              <span className={`badge ${paymentBadgeClass(tx.paymentMethod)}`}>{payLabel}</span>
            )}
            {wallet && (
              <span className="badge badge-wallet" style={{ ['--wallet-color' as string]: wallet.color }}>
                {wallet.name}
              </span>
            )}
          </div>
          <div className="meta">
            {tx.date}
            {tx.note ? ` · ${tx.note}` : ''}
            {tx.currency !== 'RMB' ? ` · ${formatMoney(tx.amount, tx.currency)}@${tx.rate}` : ''}
          </div>
        </div>
        <div className={`tx-amount ${amountClass}`}>
          {sign}
          {formatRmb(tx.amountRmb)}
        </div>
      </button>
    </li>
  );
}

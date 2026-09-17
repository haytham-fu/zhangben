import { useMemo, useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { Bucket, Currency, PaymentMethod, Transaction } from '../types';
import {
  CURRENCY_META,
  formatRmb,
  getRate,
  orderedCurrenciesForPicker,
  toRmbWithRate,
} from '../utils/currency';
import { PAYMENT_LABEL } from '../utils/payment';
import { ModalPortal } from './ModalPortal';
import { PaymentPicker } from './PaymentPicker';

interface Props {
  tx: Transaction;
  store: Store;
  onClose: () => void;
}

export function EditTransactionSheet({ tx, store, onClose }: Props) {
  const { categories, wallets, settings, updateTransaction, deleteTransaction } = store;

  const [date, setDate] = useState(tx.date);
  const [amount, setAmount] = useState(String(tx.amount));
  const [currency, setCurrency] = useState<Currency>(tx.currency);
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const [note, setNote] = useState(tx.note ?? '');
  const [isSpecial, setIsSpecial] = useState(!!tx.isSpecial);
  const [isMonthly, setIsMonthly] = useState(!!tx.isMonthly);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    tx.paymentMethod === 'none' ? 'other' : tx.paymentMethod,
  );
  const [walletId, setWalletId] = useState<string | null>(tx.walletId ?? null);
  const [bucketOverride, setBucketOverride] = useState<Bucket | null>(null);


  const isTopup = tx.kind === 'topup';
  const isIncome = tx.type === 'income';
  const isExpense = tx.type === 'expense' && !isTopup;

  const expenseCats = useMemo(
    () =>
      categories.filter(
        (c) =>
          !c.id.startsWith('income_') &&
          c.id !== 'octopus_topup' &&
          c.id !== 'groceries',
      ),
    [categories],
  );

  const incomeCats = useMemo(
    () => categories.filter((c) => c.id.startsWith('income_') || c.id === 'other_basic'),
    [categories],
  );

  const filteredCats = isTopup
    ? categories.filter((c) => c.id === 'octopus_topup')
    : isIncome
      ? incomeCats
      : expenseCats;

  const selectedCat = categories.find((c) => c.id === categoryId);
  const bucket: Bucket = bucketOverride ?? selectedCat?.bucket ?? tx.bucket;

  const rate = useMemo(() => getRate(currency, settings), [currency, settings]);
  const previewRmb = (() => {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return 0;
    const r = isTopup ? getRate('HKD', settings) : rate;
    return toRmbWithRate(n, r);
  })();

  function handleSave() {
    const n = parseFloat(amount);
    if (Number.isNaN(n) || n <= 0) {
      alert('请输入有效金额');
      return;
    }

    let catId = categoryId;
    let nextBucket = bucket;
    const nextMonthly = isExpense && isMonthly;
    const nextSpecial = isExpense && isSpecial;

    if (nextMonthly) {
      const m = categories.find((c) => c.id === 'membership');
      if (m) {
        catId = m.id;
        nextBucket = m.bucket;
      }
    } else if (selectedCat) {
      nextBucket = bucketOverride ?? selectedCat.bucket;
    }

    const pay: PaymentMethod = isTopup ? 'octopus' : isIncome ? 'none' : paymentMethod;
    const cur: Currency = isTopup ? 'HKD' : currency;
    const nextRate = getRate(cur, settings);

    updateTransaction(tx.id, {
      date,
      amount: n,
      currency: cur,
      rate: nextRate,
      categoryId: catId,
      bucket: nextBucket,
      note: note.trim(),
      isSpecial: nextSpecial,
      isMonthly: nextMonthly,
      paymentMethod: pay,
      walletId: isExpense ? walletId : null,
    });
    onClose();
  }

  function handleDelete() {
    if (!confirm('确定删除这条记录？')) return;
    deleteTransaction(tx.id);
    onClose();
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div
          className="modal-sheet"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="编辑流水"
        >
          <div className="modal-handle" />
          <h2 className="glass-title">编辑流水</h2>
          <div className="modal-sheet-body">
            <p className="hint" style={{ marginBottom: 10 }}>
              {isTopup ? '八达通充值' : isIncome ? '收入' : '支出'}
              {tx.isGroceryPurchase ? ' · 买菜购置' : ''}
              {tx.pantryUseIds && tx.pantryUseIds.length > 0 ? ' · 做饭均摊' : ''}
            </p>

            <div className="field">
              <label>日期</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="row-2">
              <div className="field">
                <label>金额</label>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="field">
                <label>币种</label>
                <select
                  value={isTopup ? 'HKD' : currency}
                  disabled={isTopup}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  {orderedCurrenciesForPicker(settings.preferredCurrencies).map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_META[c].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
              ≈ {formatRmb(previewRmb)}
              {isTopup ? '（充值不计预算支出）' : ''}
            </p>

            {!isTopup && (
              <div className="field">
                <label>分类</label>
                <div className="cat-grid">
                  {filteredCats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`cat-btn ${categoryId === c.id ? 'active' : ''}`}
                      onClick={() => {
                        setCategoryId(c.id);
                        setBucketOverride(null);
                        if (c.id === 'membership') setIsMonthly(true);
                      }}
                    >
                      <span className="emoji emoji-bubble">{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isExpense && (
              <>
                <div className="field">
                  <label>支付方式</label>
                  <PaymentPicker
                    value={paymentMethod}
                    onChange={(m) => {
                      setPaymentMethod(m);
                      if (m === 'octopus') setCurrency('HKD');
                    }}
                    compact
                  />
                </div>

                <div className="field">
                  <label>预算桶</label>
                  <div className="chip-row">
                    <button
                      type="button"
                      className={`chip ${bucket === 'basic' ? 'active' : ''}`}
                      onClick={() => setBucketOverride('basic')}
                    >
                      基础
                    </button>
                    <button
                      type="button"
                      className={`chip ${bucket === 'special' ? 'active' : ''}`}
                      onClick={() => setBucketOverride('special')}
                    >
                      专项
                    </button>
                  </div>
                </div>

                <div className="toggle-row">
                  <span style={{ fontSize: '0.85rem' }}>请客特例</span>
                  <button
                    type="button"
                    className={`toggle ${isSpecial ? 'on' : ''}`}
                    onClick={() => setIsSpecial((v) => !v)}
                    aria-label="请客特例"
                  />
                </div>
                <div className="toggle-row">
                  <span style={{ fontSize: '0.85rem' }}>月度支出</span>
                  <button
                    type="button"
                    className={`toggle ${isMonthly ? 'on' : ''}`}
                    onClick={() => {
                      setIsMonthly((v) => {
                        const next = !v;
                        if (next) setCategoryId('membership');
                        return next;
                      });
                    }}
                    aria-label="月度支出"
                  />
                </div>
                {isMonthly && <p className="hint">月度支出通常计入专项，不拆入日计划。</p>}

                <div className="field">
                  <label>小荷包（可选）</label>
                  <div className="chip-row wallet-pick-row">
                    <button
                      type="button"
                      className={`chip ${walletId == null ? 'active' : ''}`}
                      onClick={() => setWalletId(null)}
                    >
                      不指定
                    </button>
                    {wallets.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={`chip chip-with-icon ${walletId === w.id ? 'active' : ''}`}
                        onClick={() => setWalletId(w.id)}
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
                </div>
              </>
            )}

            {isTopup && <p className="hint">支付方式：{PAYMENT_LABEL.octopus}（固定）</p>}

            <div className="field">
              <label>备注</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
              保存修改
            </button>
            <button type="button" className="btn btn-danger btn-block" onClick={handleDelete}>
              删除
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
              退出
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

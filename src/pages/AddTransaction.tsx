import { useMemo, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { PaymentPicker } from '../components/PaymentPicker';
import type { Store } from '../hooks/useStore';
import type { Bucket, Currency, PaymentMethod, TxKind, TxType } from '../types';
import { formatRmb, getRate } from '../utils/currency';
import { OcrImport } from './OcrImport';

interface Props {
  store: Store;
  onDone: () => void;
}

type Mode = 'ocr' | 'manual' | 'batch';

export function AddTransaction({ store, onDone }: Props) {
  const { categories, settings, todayStr, addTransaction } = store;
  const [mode, setMode] = useState<Mode>('ocr');
  const [type, setType] = useState<TxType>('expense');
  const [kind, setKind] = useState<TxKind>('normal');
  const [date, setDate] = useState(todayStr);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('RMB');
  const [categoryId, setCategoryId] = useState('food');
  const [note, setNote] = useState('');
  const [isSpecial, setIsSpecial] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('other');
  const [batchText, setBatchText] = useState('');

  const selected = categories.find((c) => c.id === categoryId);
  const bucket: Bucket = selected?.bucket ?? 'basic';
  const showPayment = type === 'expense' && (selected?.allowPayment || kind === 'topup');

  const filteredCats = useMemo(() => {
    if (type === 'income') {
      return categories.filter((c) => c.id.startsWith('income_') || c.id === 'other_basic');
    }
    if (kind === 'topup') {
      return categories.filter((c) => c.id === 'octopus_topup');
    }
    return categories.filter((c) => !c.id.startsWith('income_') && c.id !== 'octopus_topup');
  }, [categories, type, kind]);

  const previewRmb = (() => {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return 0;
    const cur = kind === 'topup' ? 'HKD' : currency;
    return Math.round(n * getRate(cur, settings) * 100) / 100;
  })();

  function submitSingle() {
    const n = parseFloat(amount);
    if (Number.isNaN(n) || n <= 0) {
      alert('请输入有效金额');
      return;
    }
    const cat = filteredCats.find((c) => c.id === categoryId) ?? filteredCats[0];
    if (!cat) return;
    const pay: PaymentMethod =
      kind === 'topup' ? 'octopus' : showPayment ? paymentMethod : 'none';
    addTransaction({
      type: kind === 'topup' ? 'expense' : type,
      kind,
      date,
      amount: n,
      currency: kind === 'topup' ? 'HKD' : currency,
      categoryId: cat.id,
      bucket: cat.bucket,
      note,
      isSpecial: kind === 'topup' ? false : isSpecial,
      paymentMethod: pay,
    });
    setAmount('');
    setNote('');
    setIsSpecial(false);
    onDone();
  }

  function submitBatch() {
    const lines = batchText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      alert('请粘贴至少一行');
      return;
    }
    let ok = 0;
    for (const line of lines) {
      const parts = line.split(/[,，\t ]+/).filter(Boolean);
      let d = date;
      let amtStr = '';
      let nnote = '';
      let catId = 'transport';
      if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
        d = parts[0];
        amtStr = parts[1];
        nnote = parts.slice(2).join(' ');
      } else if (parts.length >= 2) {
        amtStr = parts[0];
        nnote = parts.slice(1).join(' ');
      } else {
        amtStr = parts[0];
      }
      const n = parseFloat(amtStr);
      if (Number.isNaN(n) || n <= 0) continue;
      if (/洗衣|laundry|5\+3/.test(nnote)) catId = 'laundry';
      else if (/空调|冷气|ac/.test(nnote)) catId = 'ac';
      else if (/饭|餐|食|吃|食堂/.test(nnote)) catId = 'food';
      else if (/充值|增值|top.?up/i.test(nnote)) {
        addTransaction({
          type: 'expense',
          kind: 'topup',
          date: d,
          amount: n,
          currency: 'HKD',
          categoryId: 'octopus_topup',
          bucket: 'basic',
          note: nnote || '八达通充值',
          paymentMethod: 'octopus',
        });
        ok++;
        continue;
      }
      addTransaction({
        type: 'expense',
        kind: 'normal',
        date: d,
        amount: n,
        currency: 'HKD',
        categoryId: catId,
        bucket: 'basic',
        note: nnote || '八达通',
        paymentMethod: 'octopus',
      });
      ok++;
    }
    alert(`已导入 ${ok} 条八达通记录（充值行已标为不计支出）`);
    setBatchText('');
    onDone();
  }

  if (mode === 'ocr') {
    return (
      <OcrImport
        store={store}
        onDone={onDone}
        onManual={() => setMode('manual')}
      />
    );
  }

  return (
    <>
      <GlassCard title="手动记一笔">
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" onClick={() => setMode('ocr')}>
            📷 截图识别
          </button>
          <button
            type="button"
            className={`chip ${mode === 'manual' && type === 'expense' && kind === 'normal' ? 'active' : ''}`}
            onClick={() => {
              setMode('manual');
              setType('expense');
              setKind('normal');
              setCategoryId('food');
            }}
          >
            支出
          </button>
          <button
            type="button"
            className={`chip ${type === 'income' ? 'active' : ''}`}
            onClick={() => {
              setMode('manual');
              setType('income');
              setKind('normal');
              setCategoryId('income_aa');
            }}
          >
            收入
          </button>
          <button
            type="button"
            className={`chip ${kind === 'topup' ? 'active' : ''}`}
            onClick={() => {
              setMode('manual');
              setKind('topup');
              setType('expense');
              setCurrency('HKD');
              setCategoryId('octopus_topup');
              setPaymentMethod('octopus');
            }}
          >
            充值
          </button>
          <button
            type="button"
            className={`chip ${mode === 'batch' ? 'active' : ''}`}
            onClick={() => setMode('batch')}
          >
            文本批量
          </button>
        </div>

        {mode === 'batch' ? (
          <>
            <p className="hint" style={{ marginBottom: 8 }}>
              每行一条，HKD。格式：金额 备注 或 日期 金额 备注。含「充值」不计支出。
            </p>
            <div className="field">
              <label>默认日期</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>粘贴明细</label>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={'12.5 地铁\n2026-09-15 5 洗衣\n100 充值'}
              />
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={submitBatch}>
              导入
            </button>
          </>
        ) : (
          <>
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
                  value={kind === 'topup' ? 'HKD' : currency}
                  disabled={kind === 'topup'}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  <option value="RMB">人民币 RMB</option>
                  <option value="HKD">港币 HKD</option>
                  <option value="USD">美元 USD</option>
                </select>
              </div>
            </div>
            <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
              ≈ {formatRmb(previewRmb)}
              {kind === 'topup' && '（充值不计预算支出）'}
            </p>

            <div className="field">
              <label>分类</label>
              <div className="cat-grid">
                {filteredCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cat-btn ${categoryId === c.id ? 'active' : ''}`}
                    onClick={() => setCategoryId(c.id)}
                  >
                    <span className="emoji">{c.icon}</span>
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="hint">预算桶：{bucket === 'special' ? '专项 1500' : '基础 3500'}</p>
            </div>

            {showPayment && (
              <div className="field">
                <label>支付方式</label>
                <PaymentPicker
                  value={kind === 'topup' ? 'octopus' : paymentMethod}
                  onChange={(m) => {
                    setPaymentMethod(m);
                    if (m === 'octopus') setCurrency('HKD');
                  }}
                />
              </div>
            )}

            {type === 'expense' && kind === 'normal' && (
              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>特例（请客等）</span>
                <button
                  type="button"
                  className={`toggle ${isSpecial ? 'on' : ''}`}
                  onClick={() => setIsSpecial((v) => !v)}
                  aria-label="特例"
                />
              </div>
            )}

            <div className="field">
              <label>备注</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={submitSingle}>
              保存
            </button>
          </>
        )}
      </GlassCard>
    </>
  );
}

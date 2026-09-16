import { useEffect, useMemo, useState } from 'react';
import { BudgetFxBar } from '../components/BudgetFxBar';
import { GlassCard } from '../components/GlassCard';
import { IconAdd, IconPayment } from '../components/CuteIcons';
import { PaymentPicker } from '../components/PaymentPicker';
import type { Store } from '../hooks/useStore';
import type { Bucket, Currency, PaymentMethod, TxKind, TxType } from '../types';
import {
  CURRENCY_META,
  formatRmb,
  orderedCurrenciesForPicker,
  toRmbWithRate,
} from '../utils/currency';
import type { DeepLinkAddPrefill } from '../utils/deepLink';
import { applyLiveBundleToSettings, fetchLiveRates, resolveRate } from '../utils/fx';
import { PAYMENT_LABEL } from '../utils/payment';
import { OcrImport } from './OcrImport';

interface Props {
  store: Store;
  onDone: () => void;
  deepLink?: DeepLinkAddPrefill | null;
  onDeepLinkConsumed?: () => void;
}

type Mode = 'hub' | 'wizard' | 'ocr' | 'income' | 'topup' | 'batch';
type WizardStep = 'category' | 'payment' | 'details';

export function AddTransaction({ store, onDone, deepLink = null, onDeepLinkConsumed }: Props) {
  const { categories, wallets, settings, todayStr, addTransaction, updateSettings } = store;
  const [mode, setMode] = useState<Mode>('hub');
  const [wizardStep, setWizardStep] = useState<WizardStep>('category');
  const [type, setType] = useState<TxType>('expense');
  const [kind, setKind] = useState<TxKind>('normal');
  const [date, setDate] = useState(todayStr);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('RMB');
  const [categoryId, setCategoryId] = useState('food');
  const [note, setNote] = useState('');
  const [isSpecial, setIsSpecial] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('other');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [batchText, setBatchText] = useState('');
  const [rateNote, setRateNote] = useState('');
  const [resolvedRate, setResolvedRate] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);

  const selected = categories.find((c) => c.id === categoryId);
  const bucket: Bucket = selected?.bucket ?? 'basic';

  const expenseCats = useMemo(
    () => categories.filter((c) => !c.id.startsWith('income_') && c.id !== 'octopus_topup'),
    [categories],
  );

  const incomeCats = useMemo(
    () => categories.filter((c) => c.id.startsWith('income_') || c.id === 'other_basic'),
    [categories],
  );

  const filteredCats = useMemo(() => {
    if (type === 'income') return incomeCats;
    if (kind === 'topup') return categories.filter((c) => c.id === 'octopus_topup');
    return expenseCats;
  }, [categories, type, kind, expenseCats, incomeCats]);

  const activeCurrency: Currency = kind === 'topup' ? 'HKD' : currency;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRateLoading(true);
      try {
        const r = await resolveRate(activeCurrency, settings);
        if (cancelled) return;
        setResolvedRate(r.rate);
        setRateNote(r.note);
        if (r.source === 'live' && r.fetchedAt && settings.fxRateMode === 'live') {
          // persist cache quietly when fresh live data
          try {
            const bundle = await fetchLiveRates();
            if (!cancelled) {
              updateSettings(applyLiveBundleToSettings(bundle));
            }
          } catch {
            /* already have resolved rate */
          }
        }
      } finally {
        if (!cancelled) setRateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCurrency, settings.fxRateMode, settings.fixedRates, settings.liveRates, kind]);

  const previewRmb = (() => {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return 0;
    return toRmbWithRate(n, resolvedRate);
  })();

  function resetForm() {
    setAmount('');
    setNote('');
    setIsSpecial(false);
    setDate(todayStr);
    setCurrency('RMB');
    setPaymentMethod('other');
    setWalletId(null);
  }

  function startExpenseWizard(prefill?: DeepLinkAddPrefill | null) {
    setMode('wizard');
    setWizardStep('category');
    setType('expense');
    setKind('normal');
    setCategoryId('food');
    setPaymentMethod('other');
    setCurrency(prefill?.currency ?? 'RMB');
    setAmount(prefill?.amount ?? '');
    setNote(prefill?.note ?? '');
    setIsSpecial(false);
    setDate(todayStr);
    setWalletId(null);
  }

  useEffect(() => {
    if (!deepLink) return;
    startExpenseWizard(deepLink);
    onDeepLinkConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  async function submitSingle() {
    const n = parseFloat(amount);
    if (Number.isNaN(n) || n <= 0) {
      alert('请输入有效金额');
      return;
    }
    const cat = filteredCats.find((c) => c.id === categoryId) ?? filteredCats[0];
    if (!cat) return;
    const pay: PaymentMethod =
      kind === 'topup' ? 'octopus' : type === 'expense' ? paymentMethod : 'none';
    const cur: Currency = kind === 'topup' ? 'HKD' : currency;
    const resolved = await resolveRate(cur, settings);
    if (resolved.source === 'live' && resolved.fetchedAt) {
      try {
        const bundle = await fetchLiveRates();
        updateSettings(applyLiveBundleToSettings(bundle));
      } catch {
        /* ignore */
      }
    }
    addTransaction({
      type: kind === 'topup' ? 'expense' : type,
      kind,
      date,
      amount: n,
      currency: cur,
      categoryId: cat.id,
      bucket: cat.bucket,
      note,
      isSpecial: kind === 'topup' ? false : isSpecial,
      paymentMethod: pay,
      rate: resolved.rate,
      walletId: kind === 'topup' || type === 'income' ? null : walletId,
    });
    resetForm();
    onDone();
  }

  async function submitBatch() {
    const lines = batchText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      alert('请粘贴至少一行');
      return;
    }
    const resolved = await resolveRate('HKD', settings);
    const batchRate = resolved.rate;
    if (resolved.source === 'fallback') {
      /* keep going with fallback note */
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
          rate: batchRate,
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
        rate: batchRate,
      });
      ok++;
    }
    alert(`已导入 ${ok} 条八达通记录（充值行已标为不计支出）`);
    setBatchText('');
    onDone();
  }

  if (mode === 'ocr') {
    return (
      <OcrImport store={store} onDone={onDone} onManual={() => setMode('hub')} />
    );
  }

  if (mode === 'hub') {
    return (
      <>
        <BudgetFxBar store={store} />
        <GlassCard title="记账">
          <div className="add-hero">
            <div className="add-hero-icon" aria-hidden>
              <IconAdd size={56} />
            </div>
            <div className="add-hero-actions">
              <button type="button" className="btn btn-primary btn-block add-hero-btn" onClick={() => startExpenseWizard()}>
                记账
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  setMode('income');
                  setType('income');
                  setKind('normal');
                  setCategoryId('income_aa');
                }}
              >
                收入
              </button>
            </div>
          </div>
        </GlassCard>
      </>
    );
  }

  if (mode === 'wizard') {
    return (
      <>
        <GlassCard title="记一笔支出">
          {wizardStep === 'details' && selected && (
            <div className="wizard-summary section-gap">
              <button type="button" className="chip chip-with-icon" onClick={() => setWizardStep('category')}>
                <span className="emoji-bubble">{selected.icon}</span>
                {selected.name}
              </button>
              <button type="button" className="chip chip-with-icon" onClick={() => setWizardStep('payment')}>
                <IconPayment method={paymentMethod} size={18} />
                {PAYMENT_LABEL[paymentMethod]}
              </button>
            </div>
          )}

          {wizardStep === 'details' && (
            <>
              <div className="field section-gap">
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
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>币种</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                    {orderedCurrenciesForPicker(settings.preferredCurrencies).map((c) => (
                      <option key={c} value={c}>
                        {CURRENCY_META[c].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
                ≈ {formatRmb(previewRmb)} · 预算桶：{bucket === 'special' ? '专项 1500' : '基础 3500'}
                {rateLoading ? ' · 汇率刷新中…' : rateNote ? ` · ${rateNote}` : ''}
              </p>
              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>特例（请客等）</span>
                <button
                  type="button"
                  className={`toggle ${isSpecial ? 'on' : ''}`}
                  onClick={() => setIsSpecial((v) => !v)}
                  aria-label="特例"
                />
              </div>
              <div className="field">
                <label>备注</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
              </div>
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
                      <span className="wallet-chip-dot" style={{ background: w.color }} aria-hidden />
                      {w.name}
                    </button>
                  ))}
                </div>
                {wallets.length === 0 && (
                  <p className="hint">暂无小荷包，可在「小荷包」页新建</p>
                )}
              </div>

              <button type="button" className="btn btn-primary btn-block" onClick={submitSingle}>
                保存
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block section-gap"
                onClick={() => setWizardStep('payment')}
              >
                返回改扣款方法
              </button>
            </>
          )}

          <button type="button" className="btn btn-secondary btn-block section-gap" onClick={() => setMode('hub')}>
            返回
          </button>
        </GlassCard>

        {wizardStep === 'category' && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="选择支出类型">
              <div className="modal-handle" />
              <h2 className="glass-title">选择支出类型</h2>
              <p className="sheet-section-label">基础生活</p>
              <div className="cat-grid">
                {expenseCats
                  .filter((c) => c.bucket === 'basic')
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`cat-btn ${categoryId === c.id ? 'active' : ''}`}
                      onClick={() => {
                        setCategoryId(c.id);
                        setWalletId(null);
                        setWizardStep('payment');
                      }}
                    >
                      <span className="emoji emoji-bubble">{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
              </div>
              <p className="sheet-section-label section-gap">专项</p>
              <div className="cat-grid">
                {expenseCats
                  .filter((c) => c.bucket === 'special')
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`cat-btn ${categoryId === c.id ? 'active' : ''}`}
                      onClick={() => {
                        setCategoryId(c.id);
                        setWalletId(null);
                        setWizardStep('payment');
                      }}
                    >
                      <span className="emoji emoji-bubble">{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
              </div>
              <button type="button" className="btn btn-secondary btn-block section-gap" onClick={() => setMode('hub')}>
                取消
              </button>
            </div>
          </div>
        )}

        {wizardStep === 'payment' && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="选择扣款方法">
              <div className="modal-handle" />
              <h2 className="glass-title">选择扣款方法</h2>
              <p className="hint" style={{ marginBottom: 8 }}>
                已选：{selected?.icon} {selected?.name}（{bucket === 'special' ? '专项' : '基础'}）
              </p>
              <div className="pay-sheet-grid">
                {(['octopus', 'alipay', 'wechat', 'bank', 'credit', 'other'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`pay-sheet-btn ${paymentMethod === m ? 'active' : ''}`}
                    onClick={() => {
                      setPaymentMethod(m);
                      if (m === 'octopus') setCurrency('HKD');
                      else setCurrency('RMB');
                      setWizardStep('details');
                    }}
                  >
                    <IconPayment method={m} size={28} />
                    <span>{PAYMENT_LABEL[m]}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-block section-gap"
                onClick={() => setWizardStep('category')}
              >
                返回改类型
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <GlassCard title={mode === 'income' ? '记收入' : mode === 'topup' ? '八达通充值' : '文本批量'}>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" onClick={() => setMode('hub')}>
            ← 返回
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
              {kind === 'topup' && '（充值不计预算支出）'}
              {rateLoading ? ' · 汇率刷新中…' : rateNote ? ` · ${rateNote}` : ''}
            </p>

            {mode === 'income' && (
              <div className="field">
                <label>分类</label>
                <div className="cat-grid">
                  {incomeCats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`cat-btn ${categoryId === c.id ? 'active' : ''}`}
                      onClick={() => setCategoryId(c.id)}
                    >
                      <span className="emoji emoji-bubble">{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'topup' && (
              <div className="field">
                <label>支付方式</label>
                <PaymentPicker value="octopus" onChange={() => setPaymentMethod('octopus')} />
                <p className="hint">充值默认八达通，不计入预算支出</p>
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

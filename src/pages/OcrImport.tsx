import { useMemo, useRef, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { PaymentPicker } from '../components/PaymentPicker';
import type { Store } from '../hooks/useStore';
import type { Currency, PaymentMethod, TxKind, TxType } from '../types';
import { recognizeImages } from '../utils/ocr';
import { parseOcrText, type ParsedDraft } from '../utils/ocrParse';
import { CURRENCY_META, formatRmb, getRate, orderedCurrenciesForPicker } from '../utils/currency';
import { applyLiveBundleToSettings, fetchLiveRates, resolveRate } from '../utils/fx';
import { PAYMENT_LABEL } from '../utils/payment';

type Phase = 'upload' | 'loading' | 'review' | 'done';

interface Props {
  store: Store;
  onDone: () => void;
  onManual: () => void;
}

export function OcrImport({ store, onDone, onManual }: Props) {
  const { categories, settings, todayStr, addTransaction, updateSettings } = store;
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('upload');
  const [source, setSource] = useState<'octopus' | 'general'>('octopus');
  const [progress, setProgress] = useState({ pct: 0, label: '' });
  const [drafts, setDrafts] = useState<ParsedDraft[]>([]);
  const [rawPreview, setRawPreview] = useState('');
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);

  const year = useMemo(() => Number(todayStr.slice(0, 4)), [todayStr]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      setError('请选择图片文件');
      return;
    }
    setError('');
    setPhase('loading');
    setProgress({ pct: 0, label: '加载识别引擎…' });
    const urls = list.map((f) => URL.createObjectURL(f));
    setPreviews(urls);

    try {
      const results = await recognizeImages(list, (info) => {
        setProgress({
          pct: info.pct,
          label: `识别中 ${info.index + 1}/${info.total}（${info.pct}%）`,
        });
      });
      const combined = results.map((r) => r.text).join('\n');
      setRawPreview(combined.slice(0, 2000));
      const parsed = parseOcrText(combined, {
        source,
        defaultDate: todayStr,
        fallbackYear: year,
      });
      // Octopus source: force HKD + octopus payment unless topup already set
      const adjusted = parsed.map((d) => {
        if (source === 'octopus') {
          return {
            ...d,
            currency: 'HKD' as Currency,
            paymentMethod: 'octopus' as PaymentMethod,
            kind: d.kind === 'topup' || /充值|增值/.test(d.rawLine) ? ('topup' as TxKind) : d.kind,
            categoryId:
              d.kind === 'topup' || /充值|增值/.test(d.rawLine) ? 'octopus_topup' : d.categoryId,
          };
        }
        return d;
      });
      // re-flag topup after adjust
      const finalDrafts = adjusted.map((d) => {
        const isTopup = d.kind === 'topup' || d.categoryId === 'octopus_topup';
        return {
          ...d,
          kind: isTopup ? ('topup' as TxKind) : d.kind,
          categoryId: isTopup ? 'octopus_topup' : d.categoryId,
          type: isTopup ? ('expense' as TxType) : d.type,
        };
      });
      setDrafts(finalDrafts);
      setPhase('review');
      if (finalDrafts.length === 0) {
        setError('未识别到明显金额行，可改手动录入或检查图片清晰度。下方可查看原始文字。');
      }
    } catch (e) {
      console.error(e);
      setError('识别失败，请重试或改用手动录入。需联网下载 OCR 语言包（首次）。');
      setPhase('upload');
    }
  }

  function updateDraft(id: string, patch: Partial<ParsedDraft>) {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDraft(id: string) {
    setDrafts((list) => list.filter((d) => d.id !== id));
  }

  async function confirmImport() {
    const selected = drafts.filter((d) => d.selected && d.amount > 0);
    if (selected.length === 0) {
      alert('请至少勾选一条有效记录');
      return;
    }
    const rateCache = new Map<string, number>();
    for (const d of selected) {
      let rate = rateCache.get(d.currency);
      if (rate == null) {
        const resolved = await resolveRate(d.currency, settings);
        rate = resolved.rate;
        rateCache.set(d.currency, rate);
        if (resolved.source === 'live' && resolved.fetchedAt) {
          try {
            const bundle = await fetchLiveRates();
            updateSettings(applyLiveBundleToSettings(bundle));
          } catch {
            /* ignore */
          }
        }
      }
      addTransaction({
        type: d.type,
        kind: d.kind,
        date: d.date,
        amount: d.amount,
        currency: d.currency,
        categoryId: d.categoryId,
        bucket: d.bucket,
        note: d.note,
        isSpecial: false,
        paymentMethod: d.kind === 'topup' ? 'octopus' : d.paymentMethod,
        rate,
      });
    }
    setPhase('done');
    setTimeout(() => onDone(), 600);
  }

  const selectedCount = drafts.filter((d) => d.selected).length;

  return (
    <>
      <GlassCard title="截图识别入账">
        <p className="hint" style={{ marginTop: 0 }}>
          上传账单 / 八达通截图 → 自动识别 → 核对修改 → 确认后才写入账本
        </p>

        {phase === 'upload' && (
          <>
            <div className="field">
              <label>来源</label>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${source === 'octopus' ? 'active' : ''}`}
                  onClick={() => setSource('octopus')}
                >
                  八达通（HKD）
                </button>
                <button
                  type="button"
                  className={`chip ${source === 'general' ? 'active' : ''}`}
                  onClick={() => setSource('general')}
                >
                  一般账单
                </button>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => inputRef.current?.click()}
            >
              上传截图（可多张）
            </button>
            <button type="button" className="btn btn-secondary btn-block section-gap" onClick={onManual}>
              手动记一笔
            </button>
            {error && <p className="hint" style={{ color: 'var(--red-500)', marginTop: 10 }}>{error}</p>}
          </>
        )}

        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <p style={{ fontWeight: 650, color: 'var(--blue-700)' }}>{progress.label || '识别中…'}</p>
            <div className="progress-track" style={{ marginTop: 12 }}>
              <div
                className="progress-fill status-safe"
                style={{ width: `${Math.max(8, progress.pct)}%` }}
              />
            </div>
            <p className="hint">首次使用会下载中文识别包，请保持网络畅通</p>
            {previews.length > 0 && (
              <div className="preview-row section-gap">
                {previews.map((u) => (
                  <img key={u} src={u} alt="" className="thumb" />
                ))}
              </div>
            )}
          </div>
        )}

        {phase === 'review' && (
          <>
            {previews.length > 0 && (
              <div className="preview-row" style={{ marginBottom: 12 }}>
                {previews.map((u) => (
                  <img key={u} src={u} alt="" className="thumb" />
                ))}
              </div>
            )}
            {error && <p className="hint" style={{ color: 'var(--orange-500)' }}>{error}</p>}
            <div className="chip-row" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className="chip"
                onClick={() => setDrafts((ds) => ds.map((d) => ({ ...d, selected: true })))}
              >
                全选
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setDrafts((ds) => ds.map((d) => ({ ...d, selected: false })))}
              >
                全不选
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setPhase('upload');
                  setDrafts([]);
                  setPreviews([]);
                }}
              >
                重新上传
              </button>
            </div>

            {drafts.length === 0 ? (
              <p className="empty">没有候选记录</p>
            ) : (
              <ul className="tx-list">
                {drafts.map((d) => {
                  const rmb = Math.round(d.amount * getRate(d.currency, settings) * 100) / 100;
                  return (
                    <li key={d.id} className="ocr-draft glass-inner">
                      <div className="toggle-row" style={{ paddingTop: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 650 }}>
                          <input
                            type="checkbox"
                            checked={d.selected}
                            onChange={(e) => updateDraft(d.id, { selected: e.target.checked })}
                            style={{ width: 18, height: 18 }}
                          />
                          导入此条
                          {d.kind === 'topup' && (
                            <span className="badge badge-topup">充值·不计支出</span>
                          )}
                          <span className={`badge badge-${d.confidence}`}>{d.confidence}</span>
                        </label>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeDraft(d.id)}>
                          移除
                        </button>
                      </div>
                      <div className="row-2">
                        <div className="field">
                          <label>日期</label>
                          <input
                            type="date"
                            value={d.date}
                            onChange={(e) => updateDraft(d.id, { date: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label>金额</label>
                          <input
                            type="number"
                            step="0.01"
                            value={d.amount}
                            onChange={(e) =>
                              updateDraft(d.id, { amount: parseFloat(e.target.value) || 0 })
                            }
                          />
                        </div>
                      </div>
                      <div className="row-2">
                        <div className="field">
                          <label>币种</label>
                          <select
                            value={d.currency}
                            onChange={(e) =>
                              updateDraft(d.id, { currency: e.target.value as Currency })
                            }
                          >
                            {orderedCurrenciesForPicker(settings.preferredCurrencies).map((c) => (
                              <option key={c} value={c}>
                                {CURRENCY_META[c].short}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>类型</label>
                          <select
                            value={d.kind === 'topup' ? 'topup' : d.type}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === 'topup') {
                                updateDraft(d.id, {
                                  kind: 'topup',
                                  type: 'expense',
                                  categoryId: 'octopus_topup',
                                  paymentMethod: 'octopus',
                                  currency: 'HKD',
                                });
                              } else if (v === 'income') {
                                updateDraft(d.id, {
                                  kind: 'normal',
                                  type: 'income',
                                  categoryId: 'income_other',
                                });
                              } else {
                                updateDraft(d.id, { kind: 'normal', type: 'expense' });
                              }
                            }}
                          >
                            <option value="expense">支出</option>
                            <option value="income">收入</option>
                            <option value="topup">充值（不计支出）</option>
                          </select>
                        </div>
                      </div>
                      <div className="field">
                        <label>分类</label>
                        <select
                          value={d.categoryId}
                          onChange={(e) => {
                            const cat = categories.find((c) => c.id === e.target.value);
                            updateDraft(d.id, {
                              categoryId: e.target.value,
                              bucket: cat?.bucket ?? d.bucket,
                            });
                          }}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {d.type === 'expense' && (
                        <div className="field">
                          <label>支付方式</label>
                          <PaymentPicker
                            value={d.paymentMethod === 'none' ? 'other' : d.paymentMethod}
                            onChange={(m) => {
                              const patch: Partial<ParsedDraft> = { paymentMethod: m };
                              if (m === 'octopus' && source === 'octopus') patch.currency = 'HKD';
                              updateDraft(d.id, patch);
                            }}
                            compact
                          />
                        </div>
                      )}
                      <div className="field">
                        <label>备注</label>
                        <input
                          value={d.note}
                          onChange={(e) => updateDraft(d.id, { note: e.target.value })}
                        />
                      </div>
                      <p className="hint">
                        ≈ {formatRmb(rmb)} · 原文：{d.rawLine.slice(0, 60)}
                        {d.paymentMethod !== 'none' ? ` · ${PAYMENT_LABEL[d.paymentMethod]}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block section-gap"
              onClick={confirmImport}
              disabled={selectedCount === 0}
            >
              确认导入 {selectedCount} 条
            </button>
            <button type="button" className="btn btn-secondary btn-block section-gap" onClick={onManual}>
              改手动录入
            </button>

            {rawPreview && (
              <details className="section-gap">
                <summary className="hint">查看 OCR 原始文字</summary>
                <pre className="ocr-raw">{rawPreview}</pre>
              </details>
            )}
          </>
        )}

        {phase === 'done' && <p className="empty">已写入账本 ✓</p>}
      </GlassCard>
    </>
  );
}

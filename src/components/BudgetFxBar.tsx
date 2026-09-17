import { useState } from 'react';
import { AmountInput } from './AmountInput';
import { GlassCard } from './GlassCard';
import type { Store } from '../hooks/useStore';
import type { Currency, ForeignCurrency } from '../types';
import {
  ALL_CURRENCIES,
  CURRENCY_META,
  FOREIGN_CURRENCIES,
  formatRmb,
  getRate,
  isForeignCurrency,
  normalizePreferredCurrencies,
  setFixedRate,
  toRmb,
} from '../utils/currency';
import {
  applyLiveBundleToSettings,
  fetchLiveRates,
  formatLiveRatesSummary,
} from '../utils/fx';

interface Props {
  store: Store;
}

export function BudgetFxBar({ store }: Props) {
  const { settings, updateSettings, monthStats } = store;
  const [fxBusy, setFxBusy] = useState(false);
  const [fxMsg, setFxMsg] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [convAmounts, setConvAmounts] = useState<Partial<Record<ForeignCurrency, string>>>({});

  const preferred = normalizePreferredCurrencies(settings.preferredCurrencies);
  const { basicUsed, specialUsed, basicRemain: basicLeft, specialRemain: specialLeft } = monthStats;
  const isLive = settings.fxRateMode === 'live';

  function togglePreferred(c: Currency) {
    const cur = normalizePreferredCurrencies(settings.preferredCurrencies);
    if (cur.includes(c)) {
      if (cur.length <= 1) return;
      updateSettings({ preferredCurrencies: cur.filter((x) => x !== c) });
      return;
    }
    if (cur.length >= 4) {
      setFxMsg('最多选择 4 个偏好币种');
      return;
    }
    updateSettings({ preferredCurrencies: [...cur, c] });
    setFxMsg('');
  }

  async function refreshLiveRates() {
    setFxBusy(true);
    setFxMsg('');
    try {
      const bundle = await fetchLiveRates();
      updateSettings(applyLiveBundleToSettings(bundle));
      setFxMsg(`已更新：${formatLiveRatesSummary(bundle.rates, preferred)}`);
    } catch {
      setFxMsg('实时汇率获取失败，将继续使用固定/缓存汇率');
    } finally {
      setFxBusy(false);
    }
  }

  const foreignPrefs = preferred.filter(isForeignCurrency);
  const rateCurrencies: ForeignCurrency[] =
    foreignPrefs.length > 0 ? foreignPrefs : (['HKD', 'USD'] as ForeignCurrency[]);

  const liveHint = isLive
    ? [
        formatLiveRatesSummary(settings.liveRates, preferred),
        settings.liveRatesUpdatedAt
          ? `更新于 ${settings.liveRatesUpdatedAt.slice(0, 16).replace('T', ' ')}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '记账时使用下方固定汇率';

  return (
    <GlassCard title="预算与汇率">
      <div className="bfx">
        <p className="sheet-section-label bfx-label">本月预算</p>
        <div className="stat-grid bfx-stats">
          <div className="stat-pill">
            <div className="k">基础剩余</div>
            <div className="v" style={{ color: basicLeft < 0 ? 'var(--red-500)' : undefined }}>
              {formatRmb(basicLeft)}
            </div>
            <div className="hint" style={{ margin: '4px 0 0' }}>
              预算 {formatRmb(settings.basicBudget)} · 已用 {formatRmb(basicUsed)}
            </div>
          </div>
          <div className="stat-pill">
            <div className="k">专项剩余</div>
            <div className="v" style={{ color: specialLeft < 0 ? 'var(--red-500)' : undefined }}>
              {formatRmb(specialLeft)}
            </div>
            <div className="hint" style={{ margin: '4px 0 0' }}>
              预算 {formatRmb(settings.specialBudget)} · 已用 {formatRmb(specialUsed)}
            </div>
          </div>
        </div>

        <div className="row-2 bfx-budget-inputs">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>基础预算</label>
            <AmountInput
              value={settings.basicBudget}
              onValueChange={(n) => updateSettings({ basicBudget: n })}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>专项预算</label>
            <AmountInput
              value={settings.specialBudget}
              onValueChange={(n) => updateSettings({ specialBudget: n })}
            />
          </div>
        </div>

        <div className="bfx-fx-row">
          <p className="sheet-section-label bfx-label" style={{ marginBottom: 0 }}>
            汇率
          </p>
          <div className="chip-row bfx-mode-row">
            <button
              type="button"
              className={`chip chip-sm ${isLive ? 'active' : ''}`}
              onClick={() => {
                updateSettings({ fxRateMode: 'live' });
                void refreshLiveRates();
              }}
            >
              实时汇率
            </button>
            <button
              type="button"
              className={`chip chip-sm ${!isLive ? 'active' : ''}`}
              onClick={() => updateSettings({ fxRateMode: 'fixed' })}
            >
              固定汇率
            </button>
            {isLive && (
              <button
                type="button"
                className="chip chip-sm"
                disabled={fxBusy}
                onClick={() => void refreshLiveRates()}
              >
                {fxBusy ? '刷新中…' : '刷新'}
              </button>
            )}
            <button
              type="button"
              className={`chip chip-sm ${adjustOpen ? 'active' : ''}`}
              aria-expanded={adjustOpen}
              onClick={() => setAdjustOpen((v) => !v)}
            >
              调整
            </button>
          </div>
        </div>
        <p className="hint bfx-hint">{liveHint}</p>

        {adjustOpen && (
          <div className="bfx-adjust">
            <p className="hint" style={{ marginTop: 0 }}>
              固定汇率（离线回退）；1 外币 = ? 人民币
            </p>
            <div className="fx-rates-grid">
              {(rateCurrencies.length > 0 ? rateCurrencies : FOREIGN_CURRENCIES).map((c) => (
                <div className="field" key={c} style={{ marginBottom: 0 }}>
                  <label>
                    {CURRENCY_META[c].zh}（{c}）
                  </label>
                  <AmountInput
                    step="0.0001"
                    value={settings.fixedRates[c]}
                    onValueChange={(n) =>
                      updateSettings({
                        fixedRates: setFixedRate(settings, c, n),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="sheet-section-label bfx-label section-gap">偏好币种 · {preferred.length}/4</p>
        <div className="chip-row bfx-pref-row">
          {ALL_CURRENCIES.map((c) => {
            const on = preferred.includes(c);
            return (
              <button
                key={c}
                type="button"
                className={`chip chip-sm ${on ? 'active' : ''}`}
                onClick={() => togglePreferred(c)}
                aria-pressed={on}
              >
                {CURRENCY_META[c].zh}
              </button>
            );
          })}
        </div>

        {foreignPrefs.length > 0 && (
          <div className="bfx-converters">
            {foreignPrefs.map((c) => {
              const raw = convAmounts[c] ?? '';
              const amt = Number(raw);
              const rmb = Number.isFinite(amt) && amt !== 0 ? toRmb(amt, c, settings) : toRmb(0, c, settings);
              const rate = getRate(c, settings);
              return (
                <div className="bfx-conv-box" key={c}>
                  <div className="bfx-conv-title">
                    {CURRENCY_META[c].zh} → 人民币
                  </div>
                  <div className="bfx-conv-row">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="金额"
                      aria-label={`${CURRENCY_META[c].zh}金额`}
                      value={raw}
                      onChange={(e) =>
                        setConvAmounts((prev) => ({ ...prev, [c]: e.target.value }))
                      }
                    />
                    <span className="bfx-conv-eq" aria-hidden>
                      =
                    </span>
                    <span className="bfx-conv-rmb">{formatRmb(Number.isFinite(amt) ? rmb : 0)}</span>
                  </div>
                  <p className="hint bfx-conv-rate">
                    1 {CURRENCY_META[c].zh} ≈ {rate.toFixed(4)} 人民币
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {fxMsg && <p className="hint section-gap">{fxMsg}</p>}
      </div>
    </GlassCard>
  );
}

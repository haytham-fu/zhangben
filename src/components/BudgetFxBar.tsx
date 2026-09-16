import { useMemo, useState } from 'react';
import { GlassCard } from './GlassCard';
import type { Store } from '../hooks/useStore';
import type { Currency, ForeignCurrency } from '../types';
import {
  ALL_CURRENCIES,
  CURRENCY_META,
  FOREIGN_CURRENCIES,
  formatRmb,
  isForeignCurrency,
  normalizePreferredCurrencies,
  setFixedRate,
} from '../utils/currency';
import {
  applyLiveBundleToSettings,
  fetchLiveRates,
  formatLiveRatesSummary,
} from '../utils/fx';
import { filterMonth, netBasicSpend, specialSpend } from '../utils/budget';

interface Props {
  store: Store;
}

export function BudgetFxBar({ store }: Props) {
  const { settings, updateSettings, transactions, currentYm } = store;
  const [fxBusy, setFxBusy] = useState(false);
  const [fxMsg, setFxMsg] = useState('');
  const [ratesOpen, setRatesOpen] = useState(false);

  const preferred = normalizePreferredCurrencies(settings.preferredCurrencies);
  const opts = { includeSpecial: settings.includeSpecialInAdvice };
  const monthTxs = useMemo(() => filterMonth(transactions, currentYm), [transactions, currentYm]);
  const basicUsed = netBasicSpend(monthTxs, opts);
  const specialUsed = specialSpend(monthTxs, opts);
  const basicLeft = settings.basicBudget - basicUsed;
  const specialLeft = settings.specialBudget - specialUsed;

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

  return (
    <GlassCard title="预算与汇率">
      <div className="stat-grid" style={{ marginBottom: 10 }}>
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

      <div className="row-2" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>基础预算 (RMB)</label>
          <input
            type="number"
            value={settings.basicBudget}
            onChange={(e) => updateSettings({ basicBudget: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="field">
          <label>专项预算 (RMB)</label>
          <input
            type="number"
            value={settings.specialBudget}
            onChange={(e) => updateSettings({ specialBudget: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      <p className="sheet-section-label">汇率模式</p>
      <div className="chip-row" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`chip ${settings.fxRateMode === 'live' ? 'active' : ''}`}
          onClick={() => {
            updateSettings({ fxRateMode: 'live' });
            void refreshLiveRates();
          }}
        >
          实时汇率
        </button>
        <button
          type="button"
          className={`chip ${settings.fxRateMode === 'fixed' ? 'active' : ''}`}
          onClick={() => updateSettings({ fxRateMode: 'fixed' })}
        >
          固定汇率
        </button>
      </div>

      {settings.fxRateMode === 'live' ? (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            记账外币时拉取市场汇率并写入该笔；失败则回退固定/缓存。
          </p>
          <p className="hint">
            {formatLiveRatesSummary(settings.liveRates, preferred)}
            {settings.liveRatesUpdatedAt
              ? ` · 更新于 ${settings.liveRatesUpdatedAt.slice(0, 16).replace('T', ' ')}`
              : ''}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={fxBusy}
            onClick={() => void refreshLiveRates()}
          >
            {fxBusy ? '刷新中…' : '立即刷新实时汇率'}
          </button>
        </>
      ) : (
        <p className="hint" style={{ marginTop: 0 }}>
          使用可编辑固定汇率；每笔保存当时汇率。下方可展开编辑偏好外币。
        </p>
      )}

      <p className="sheet-section-label section-gap">偏好币种（最多 4 个）</p>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {ALL_CURRENCIES.map((c) => {
          const on = preferred.includes(c);
          return (
            <button
              key={c}
              type="button"
              className={`chip ${on ? 'active' : ''}`}
              onClick={() => togglePreferred(c)}
              aria-pressed={on}
            >
              {CURRENCY_META[c].short}
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        记账币种选择会优先展示这些；已选 {preferred.length}/4
      </p>

      <button
        type="button"
        className="btn btn-sm btn-secondary section-gap"
        onClick={() => setRatesOpen((v) => !v)}
      >
        {ratesOpen ? '收起固定汇率' : '编辑固定汇率（离线回退）'}
      </button>
      {ratesOpen && (
        <div className="fx-rates-grid section-gap">
          {(rateCurrencies.length > 0 ? rateCurrencies : FOREIGN_CURRENCIES).map((c) => (
            <div className="field" key={c}>
              <label>
                1 {c} = ? RMB
              </label>
              <input
                type="number"
                step="0.0001"
                value={settings.fixedRates[c]}
                onChange={(e) =>
                  updateSettings({
                    fixedRates: setFixedRate(settings, c, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
          ))}
          {foreignPrefs.length === 0 && (
            <p className="hint" style={{ gridColumn: '1 / -1' }}>
              未选外币偏好时显示 HKD/USD；勾选偏好后仅编辑对应币种。
            </p>
          )}
        </div>
      )}
      {fxMsg && <p className="hint section-gap">{fxMsg}</p>}
    </GlassCard>
  );
}

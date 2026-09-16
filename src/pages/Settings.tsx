import { useRef, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import type { Store } from '../hooks/useStore';
import type { BgMotion, ThemePalette } from '../types';
import { DEFAULT_SETTINGS } from '../utils/defaults';
import { downloadBlob, renderLedgerInfographic } from '../utils/exportInfographic';
import { applyLiveBundleToSettings, fetchLiveRates } from '../utils/fx';
import { exportJson, importJson } from '../utils/storage';

interface Props {
  store: Store;
}

export function SettingsPage({ store }: Props) {
  const { settings, updateSettings, ensureMusicMembership, currentYm, replaceState, resetAll, state } =
    store;
  const fileRef = useRef<HTMLInputElement>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [fxBusy, setFxBusy] = useState(false);
  const [fxMsg, setFxMsg] = useState('');
  const [jpgBusy, setJpgBusy] = useState(false);

  const dp = settings.dailyPlan;
  const planOn = settings.dailyPlanCompareEnabled !== false;

  function patchPlan(key: keyof typeof dp, value: string) {
    const n = parseFloat(value);
    if (Number.isNaN(n) || n < 0) return;
    updateSettings({ dailyPlan: { ...dp, [key]: n } });
  }

  async function refreshLiveRates() {
    setFxBusy(true);
    setFxMsg('');
    try {
      const bundle = await fetchLiveRates();
      updateSettings(applyLiveBundleToSettings(bundle));
      setFxMsg(`已更新：1 HKD = ${bundle.hkd} RMB · 1 USD = ${bundle.usd} RMB`);
    } catch {
      setFxMsg('实时汇率获取失败，将继续使用固定/缓存汇率');
    } finally {
      setFxBusy(false);
    }
  }

  async function exportJpg() {
    setJpgBusy(true);
    try {
      const blob = await renderLedgerInfographic({ ym: currentYm, state });
      downloadBlob(blob, `zhangben-${currentYm}.jpg`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '导出图片失败');
    } finally {
      setJpgBusy(false);
    }
  }

  return (
    <>
      <GlassCard title="计划对照">
        <div className="toggle-row">
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 650 }}>计划生活费每天支出对照</div>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              开启：日计划余缺、日历对照、节奏建议；关闭：简单记账汇总
            </p>
          </div>
          <button
            type="button"
            className={`toggle ${planOn ? 'on' : ''}`}
            aria-label="计划生活费每天支出对照"
            onClick={() => updateSettings({ dailyPlanCompareEnabled: !planOn })}
          />
        </div>
      </GlassCard>

      <GlassCard title="外观">
        <p className="sheet-section-label">背景</p>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {(
            [
              ['static', '静态'],
              ['dynamic', '动态'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`chip ${(settings.bgMotion ?? 'dynamic') === k ? 'active' : ''}`}
              onClick={() => updateSettings({ bgMotion: k as BgMotion })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>
          动态为柔和流动渐变；系统开启「减少动态效果」时自动回退为静态
        </p>

        <p className="sheet-section-label">配色</p>
        <div className="palette-row" style={{ marginBottom: 14 }}>
          {(
            [
              ['sky', '晴空', '#93c5fd', '#dbeafe'],
              ['mist', '薄雾', '#c7d2fe', '#e0e7ff'],
              ['sand', '暖沙', '#e8d4a8', '#f5f0e8'],
              ['sage', '鼠尾草', '#a7c4b5', '#e8f0ec'],
              ['lilac', '丁香', '#c4b5fd', '#ede9fe'],
            ] as const
          ).map(([id, label, a, b]) => (
            <button
              key={id}
              type="button"
              className={`palette-swatch ${(settings.themePalette ?? 'sky') === id ? 'active' : ''}`}
              aria-label={label}
              title={label}
              onClick={() => updateSettings({ themePalette: id as ThemePalette })}
              style={{ background: `linear-gradient(145deg, ${a}, ${b})` }}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="toggle-row">
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 650 }}>显示小金山</div>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              总览「本月预算」上方用软金色小山表示剩余预算；关闭后仅保留进度条
            </p>
          </div>
          <button
            type="button"
            className={`toggle ${settings.showGoldMountain !== false ? 'on' : ''}`}
            aria-label="显示小金山"
            onClick={() =>
              updateSettings({ showGoldMountain: !(settings.showGoldMountain !== false) })
            }
          />
        </div>
      </GlassCard>

      <GlassCard title="预算与汇率">
        <div className="row-2">
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
              记账外币时拉取市场汇率并写入该笔；失败则回退固定/缓存并提示。
            </p>
            <p className="hint">
              缓存：1 HKD = {settings.liveHkdRate ?? '—'} · 1 USD = {settings.liveUsdRate ?? '—'}
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
            {fxMsg && <p className="hint section-gap">{fxMsg}</p>}
            <p className="hint section-gap">下方固定汇率仍作离线回退备用。</p>
          </>
        ) : (
          <p className="hint" style={{ marginTop: 0 }}>
            使用下方可编辑的近似固定汇率；每笔保存当时汇率。
          </p>
        )}
        <div className="row-2">
          <div className="field">
            <label>1 HKD = ? RMB（固定）</label>
            <input
              type="number"
              step="0.01"
              value={settings.hkdRate}
              onChange={(e) => updateSettings({ hkdRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field">
            <label>1 USD = ? RMB（固定）</label>
            <input
              type="number"
              step="0.01"
              value={settings.usdRate}
              onChange={(e) => updateSettings({ usdRate: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </GlassCard>

      {planOn && (
      <GlassCard
        title="预算计划配置"
        action={
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPlanOpen((v) => !v)}>
            {planOpen ? '收起' : '编辑日计划'}
          </button>
        }
      >
        <p className="hint" style={{ marginTop: 0 }}>
          上方「基础 / 专项」月预算与下方每日额度将用于总览、日历余缺与节奏建议。
        </p>
        {!planOpen ? (
          <p className="hint" style={{ margin: 0 }}>
            一/三 {dp.mon} · 二 {dp.tue} · 四/五 {dp.thu} · 六玩 {dp.satPlay} / 不玩 {dp.satStay} · 日{' '}
            {dp.sun}
          </p>
        ) : (
          <>
            <div className="row-2">
              <div className="field">
                <label>周一</label>
                <input type="number" value={dp.mon} onChange={(e) => patchPlan('mon', e.target.value)} />
              </div>
              <div className="field">
                <label>周二</label>
                <input type="number" value={dp.tue} onChange={(e) => patchPlan('tue', e.target.value)} />
              </div>
            </div>
            <div className="row-2">
              <div className="field">
                <label>周三</label>
                <input type="number" value={dp.wed} onChange={(e) => patchPlan('wed', e.target.value)} />
              </div>
              <div className="field">
                <label>周四</label>
                <input type="number" value={dp.thu} onChange={(e) => patchPlan('thu', e.target.value)} />
              </div>
            </div>
            <div className="row-2">
              <div className="field">
                <label>周五</label>
                <input type="number" value={dp.fri} onChange={(e) => patchPlan('fri', e.target.value)} />
              </div>
              <div className="field">
                <label>周日</label>
                <input type="number" value={dp.sun} onChange={(e) => patchPlan('sun', e.target.value)} />
              </div>
            </div>
            <div className="row-2">
              <div className="field">
                <label>周六·出去玩</label>
                <input
                  type="number"
                  value={dp.satPlay}
                  onChange={(e) => patchPlan('satPlay', e.target.value)}
                />
              </div>
              <div className="field">
                <label>周六·不玩</label>
                <input
                  type="number"
                  value={dp.satStay}
                  onChange={(e) => patchPlan('satStay', e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>默认周六模式</label>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${settings.defaultSatMode === 'play' ? 'active' : ''}`}
                  onClick={() => updateSettings({ defaultSatMode: 'play' })}
                >
                  出去玩
                </button>
                <button
                  type="button"
                  className={`chip ${settings.defaultSatMode === 'stay' ? 'active' : ''}`}
                  onClick={() => updateSettings({ defaultSatMode: 'stay' })}
                >
                  不玩
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => updateSettings({ dailyPlan: { ...DEFAULT_SETTINGS.dailyPlan } })}
            >
              恢复默认日计划
            </button>
          </>
        )}
      </GlassCard>
      )}

      <GlassCard title="音乐会员（专项）">
        <div className="toggle-row">
          <span style={{ fontSize: '0.85rem' }}>月初自动入账</span>
          <button
            type="button"
            className={`toggle ${settings.musicMembershipEnabled ? 'on' : ''}`}
            onClick={() =>
              updateSettings({ musicMembershipEnabled: !settings.musicMembershipEnabled })
            }
          />
        </div>
        <div className="field">
          <label>金额 (HKD)</label>
          <input
            type="number"
            value={settings.musicMembershipHkd}
            onChange={(e) => updateSettings({ musicMembershipHkd: Number(e.target.value) || 0 })}
          />
        </div>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => ensureMusicMembership(currentYm)}>
          立即生成本月会员记录
        </button>
        <p className="hint">计入 1500 专项，不拆到天。默认 48 HKD。</p>
      </GlassCard>

      <GlassCard title="数据">
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => {
            const blob = new Blob([exportJson(state)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zhangben-backup-${currentYm}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          导出备份 JSON
        </button>
        <button
          type="button"
          className="btn btn-primary btn-block section-gap"
          disabled={jpgBusy}
          onClick={() => void exportJpg()}
        >
          {jpgBusy ? '生成中…' : '导出本月速览 JPG'}
        </button>
        <p className="hint">JPG 信息图含本月支出/收入、预算进度与分类条，方便一图分享。</p>
        <button
          type="button"
          className="btn btn-secondary btn-block section-gap"
          onClick={() => fileRef.current?.click()}
        >
          导入备份 JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              replaceState(importJson(text));
              alert('导入成功');
            } catch {
              alert('导入失败，请检查文件');
            }
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn btn-danger btn-block section-gap"
          onClick={() => {
            if (confirm('确定清空所有本地数据？不可恢复。')) resetAll();
          }}
        >
          清空本地数据
        </button>
        <p className="hint">数据仅保存在本机浏览器 localStorage，无登录、不上云。</p>
      </GlassCard>

      <GlassCard title="关于">
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          「账本」PWA · 月预算 5000 = 3500 基础 + 1500 专项。八达通充值不计支出。空调请手动记账。
        </p>
      </GlassCard>
    </>
  );
}

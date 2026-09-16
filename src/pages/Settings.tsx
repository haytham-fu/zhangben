import { useRef, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import type { Store } from '../hooks/useStore';
import type { BgMotion, ThemePalette } from '../types';
import { DEFAULT_SETTINGS } from '../utils/defaults';
import { downloadBlob, renderLedgerInfographic } from '../utils/exportInfographic';
import { exportJson, importJson, normalizeSettings } from '../utils/storage';

interface Props {
  store: Store;
}

export function SettingsPage({ store }: Props) {
  const { settings, updateSettings, currentYm, replaceState, resetAll, state } = store;
  const fileRef = useRef<HTMLInputElement>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [jpgBusy, setJpgBusy] = useState(false);

  const dp = settings.dailyPlan;
  const planOn = settings.dailyPlanCompareEnabled !== false;

  function patchPlan(key: keyof typeof dp, value: string) {
    const n = parseFloat(value);
    if (Number.isNaN(n) || n < 0) return;
    updateSettings({ dailyPlan: { ...dp, [key]: n } });
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

  async function importSeptHalfSample() {
    const replace = confirm(
      '导入「九月前半月样例账」并【替换】当前全部流水？\n（同时合并样例预算 / 汇率等到设置）\n\n点「取消」可改为合并导入。',
    );
    let mode: 'replace' | 'merge' = 'replace';
    if (!replace) {
      const merge = confirm(
        '改为【合并】样例流水到现有账本？（相同 id 跳过，仍合并样例设置）\n\n点「取消」则不导入。',
      );
      if (!merge) return;
      mode = 'merge';
    }

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sept-2026-half.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      const partial = JSON.parse(raw) as {
        settings?: Record<string, unknown>;
        transactions?: unknown;
        wallets?: unknown;
      };
      const sample = importJson(raw);
      const nextSettings = partial.settings
        ? normalizeSettings({ ...state.settings, ...partial.settings })
        : state.settings;

      if (mode === 'replace') {
        replaceState({
          ...state,
          settings: nextSettings,
          transactions: sample.transactions,
          wallets: sample.wallets.length > 0 ? sample.wallets : state.wallets,
          pantryItems: sample.pantryItems ?? state.pantryItems,
        });
        alert(`已替换导入 ${sample.transactions.length} 条样例流水`);
      } else {
        const have = new Set(state.transactions.map((t) => t.id));
        const added = sample.transactions.filter((t) => !have.has(t.id));
        const haveW = new Set(state.wallets.map((w) => w.id));
        const addedW = sample.wallets.filter((w) => !haveW.has(w.id));
        const haveP = new Set(state.pantryItems.map((x) => x.id));
        const addedP = (sample.pantryItems ?? []).filter((x) => !haveP.has(x.id));
        replaceState({
          ...state,
          settings: nextSettings,
          transactions: [...added, ...state.transactions],
          wallets: [...state.wallets, ...addedW],
          pantryItems: [...state.pantryItems, ...addedP],
        });
        alert(
          `已合并 ${added.length} 条样例流水（跳过 ${sample.transactions.length - added.length} 条重复）`,
        );
      }
    } catch (e) {
      alert(e instanceof Error ? `导入失败：${e.message}` : '导入失败');
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
        <p className="hint" style={{ margin: 0 }}>
          月预算概览、汇率模式与偏好币种已移至「记账」页顶部，便于记账时直接调整。日计划等仍在下方配置。
        </p>
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
          「记账」页顶部的基础/专项月预算与下方每日额度将用于总览、日历余缺与节奏建议。
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
          className="btn btn-secondary btn-block section-gap"
          onClick={() => void importSeptHalfSample()}
        >
          导入九月前半月样例账
        </button>
        <p className="hint">样例含 9/1–9/16 笔记 + 八达通消费（HKD×0.86），充值不计支出；可替换或合并。</p>
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

    </>
  );
}

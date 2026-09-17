import { useRef, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import type { Store } from '../hooks/useStore';
import type { BgMotion, ThemePalette } from '../types';
import { DEFAULT_SETTINGS } from '../utils/defaults';
import { downloadBlob, renderLedgerInfographic } from '../utils/exportInfographic';
import {
  fetchProfileFromUrl,
  parseProfilePack,
  safeProfileLabel,
} from '../utils/profile';
import { exportJson, importJson } from '../utils/storage';

interface Props {
  store: Store;
}

export function SettingsPage({ store }: Props) {
  const { settings, updateSettings, currentYm, replaceState, applyProfilePack, resetAll, state } = store;
  const fileRef = useRef<HTMLInputElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [jpgBusy, setJpgBusy] = useState(false);
  const [profileUrl, setProfileUrl] = useState('');
  const [profilePaste, setProfilePaste] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

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
            <div style={{ fontSize: '0.9rem', fontWeight: 650 }}>显示本月预算进度</div>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              总览「本月预算」顶部显示合计进度条与已用/剩余；关闭后仅保留下方分项进度
            </p>
          </div>
          <button
            type="button"
            className={`toggle ${settings.showMonthlyBudgetProgress !== false ? 'on' : ''}`}
            aria-label="显示本月预算进度"
            onClick={() =>
              updateSettings({
                showMonthlyBudgetProgress: !(settings.showMonthlyBudgetProgress !== false),
              })
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



      <GlassCard title="导入个人计划配置">
        <p className="hint" style={{ marginTop: 0 }}>
          公网默认为通用账本。若你有独立托管的计划 JSON（预算 / 日计划 / 期初汇总等），可在此导入；不会改动已有流水。
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={profileBusy}
          onClick={() => profileFileRef.current?.click()}
        >
          从文件导入计划配置
        </button>
        <input
          ref={profileFileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setProfileBusy(true);
            setProfileMsg('');
            try {
              const pack = parseProfilePack(await file.text());
              applyProfilePack(pack);
              setProfileMsg(`已应用：${safeProfileLabel(pack.label || pack.name || file.name)}`);
            } catch (err) {
              setProfileMsg(err instanceof Error ? err.message : '导入失败');
            } finally {
              setProfileBusy(false);
              e.target.value = '';
            }
          }}
        />
        <div className="field section-gap">
          <label>从链接导入（GitHub raw 等）</label>
          <input
            type="url"
            placeholder="https://raw.githubusercontent.com/…/haytham-ledger-profile.json"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={profileBusy || !profileUrl.trim()}
          onClick={async () => {
            setProfileBusy(true);
            setProfileMsg('');
            try {
              const pack = await fetchProfileFromUrl(profileUrl);
              applyProfilePack(pack);
              setProfileMsg(`已应用：${safeProfileLabel(pack.label || pack.name, '远程配置')}`);
            } catch (err) {
              setProfileMsg(err instanceof Error ? err.message : '下载失败');
            } finally {
              setProfileBusy(false);
            }
          }}
        >
          从链接加载
        </button>
        <div className="field section-gap">
          <label>或粘贴 JSON</label>
          <textarea
            rows={4}
            placeholder='{ "version": 1, "settings": { ... } }'
            value={profilePaste}
            onChange={(e) => setProfilePaste(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={profileBusy || !profilePaste.trim()}
          onClick={() => {
            setProfileBusy(true);
            setProfileMsg('');
            try {
              const pack = parseProfilePack(profilePaste);
              applyProfilePack(pack);
              setProfileMsg(`已应用：${safeProfileLabel(pack.label || pack.name, '粘贴配置')}`);
              setProfilePaste('');
            } catch (err) {
              setProfileMsg(err instanceof Error ? err.message : '解析失败');
            } finally {
              setProfileBusy(false);
            }
          }}
        >
          应用粘贴内容
        </button>
        {profileMsg && <p className="hint section-gap">{profileMsg}</p>}
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
        {settings.monthOpening && settings.monthOpening.ym === currentYm && (
          <p className="hint section-gap">
            本月期初汇总（{settings.monthOpening.label ?? settings.monthOpening.ym}）：基础已用 ¥
            {settings.monthOpening.basicUsed.toFixed(2)}，专项已用 ¥
            {settings.monthOpening.specialUsed.toFixed(2)}
            {settings.monthOpening.expenseRmb != null && settings.monthOpening.incomeRmb != null
              ? `（支出 ¥${settings.monthOpening.expenseRmb.toFixed(2)} − 收入 ¥${settings.monthOpening.incomeRmb.toFixed(2)}）`
              : ''}
            。不含逐日明细；新流水从今天叠加。
          </p>
        )}
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

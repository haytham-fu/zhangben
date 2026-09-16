import { useRef, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import type { Store } from '../hooks/useStore';
import { DEFAULT_SETTINGS } from '../utils/defaults';
import { exportJson, importJson } from '../utils/storage';

interface Props {
  store: Store;
}

export function SettingsPage({ store }: Props) {
  const { settings, updateSettings, ensureMusicMembership, currentYm, replaceState, resetAll, state } =
    store;
  const fileRef = useRef<HTMLInputElement>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const dp = settings.dailyPlan;

  function patchPlan(key: keyof typeof dp, value: string) {
    const n = parseFloat(value);
    if (Number.isNaN(n) || n < 0) return;
    updateSettings({ dailyPlan: { ...dp, [key]: n } });
  }

  return (
    <>
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
        <div className="row-2">
          <div className="field">
            <label>1 HKD = ? RMB</label>
            <input
              type="number"
              step="0.01"
              value={settings.hkdRate}
              onChange={(e) => updateSettings({ hkdRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="field">
            <label>1 USD = ? RMB</label>
            <input
              type="number"
              step="0.01"
              value={settings.usdRate}
              onChange={(e) => updateSettings({ usdRate: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <p className="hint">默认 1 HKD = 0.86 RMB，可随时修改；新记账使用当时汇率并保存。</p>
      </GlassCard>

      <GlassCard
        title="日计划预算"
        action={
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPlanOpen((v) => !v)}>
            {planOpen ? '收起' : '编辑'}
          </button>
        }
      >
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

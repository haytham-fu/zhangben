import { useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { IconEmptyWallet } from '../components/CuteIcons';
import { GlassCard } from '../components/GlassCard';
import { ProgressBar } from '../components/ProgressBar';
import type { Store } from '../hooks/useStore';
import type { Wallet } from '../types';
import { budgetStatus, filterMonth, netBasicSpend, specialSpend } from '../utils/budget';
import { formatRmb } from '../utils/currency';
import { WALLET_COLORS, walletSpend, walletStatus } from '../utils/wallets';

interface Props {
  store: Store;
}

type EditDraft = {
  id: string;
  name: string;
  color: string;
  allocated: string;
};

export function WalletsPage({ store }: Props) {
  const { wallets, settings, transactions, currentYm, addWallet, updateWallet, removeWallet } = store;
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [addAllocated, setAddAllocated] = useState('');

  const sortedWallets = useMemo(
    () => [...wallets].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [wallets],
  );

  const monthTxs = useMemo(() => filterMonth(transactions, currentYm), [transactions, currentYm]);
  const basicUsed = netBasicSpend(monthTxs, { includeSpecial: settings.includeSpecialInAdvice });
  const specialUsed = specialSpend(monthTxs, { includeSpecial: true });

  function openEdit(w: Wallet) {
    setEdit({
      id: w.id,
      name: w.name,
      color: w.color,
      allocated: String(w.allocated),
    });
    setAdding(false);
  }

  function saveEdit() {
    if (!edit) return;
    const n = parseFloat(edit.allocated);
    if (Number.isNaN(n) || n < 0) {
      alert('请输入有效的分配金额');
      return;
    }
    updateWallet(edit.id, {
      name: edit.name.trim() || '小荷包',
      color: edit.color,
      allocated: n,
    });
    setEdit(null);
  }

  function confirmAdd() {
    const n = addAllocated.trim() === '' ? 0 : parseFloat(addAllocated);
    if (Number.isNaN(n) || n < 0) {
      alert('请输入有效的分配金额');
      return;
    }
    addWallet(n);
    setAdding(false);
    setAddAllocated('');
  }

  function openAdd() {
    setAdding(true);
    setAddAllocated('');
    setEdit(null);
  }

  return (
    <>
      <GlassCard
        title="小荷包"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            + 新建小荷包
          </button>
        }
      >
        <p className="hint" style={{ marginBottom: 0 }}>
          与基础生活 / 专项同级的独立荷包，记账时可选用。数据保存在本机。
        </p>
      </GlassCard>

      <div className="wallet-peer-grid">
        <GlassCard title="基础生活">
          <div className="wallet-bucket-meta">
            <div className="stat-pill">
              <div className="k">预算</div>
              <div className="v">{formatRmb(settings.basicBudget)}</div>
            </div>
            <div className="stat-pill">
              <div className="k">本月已用</div>
              <div className="v">{formatRmb(basicUsed)}</div>
            </div>
            <div className="stat-pill">
              <div className="k">剩余</div>
              <div className={`v ${settings.basicBudget - basicUsed < 0 ? 'neg' : ''}`}>
                {formatRmb(settings.basicBudget - basicUsed)}
              </div>
            </div>
          </div>
          <ProgressBar
            label="本月进度"
            used={basicUsed}
            budget={settings.basicBudget}
            status={budgetStatus(basicUsed, settings.basicBudget)}
            remainLabel
          />
        </GlassCard>

        <GlassCard title="专项">
          <div className="wallet-bucket-meta">
            <div className="stat-pill">
              <div className="k">预算</div>
              <div className="v">{formatRmb(settings.specialBudget)}</div>
            </div>
            <div className="stat-pill">
              <div className="k">本月已用</div>
              <div className="v">{formatRmb(specialUsed)}</div>
            </div>
            <div className="stat-pill">
              <div className="k">剩余</div>
              <div className={`v ${settings.specialBudget - specialUsed < 0 ? 'neg' : ''}`}>
                {formatRmb(settings.specialBudget - specialUsed)}
              </div>
            </div>
          </div>
          <ProgressBar
            label="本月进度"
            used={specialUsed}
            budget={settings.specialBudget}
            status={budgetStatus(specialUsed, settings.specialBudget)}
            remainLabel
          />
        </GlassCard>
      </div>

      <GlassCard title="我的小荷包">
        {sortedWallets.length === 0 ? (
          <EmptyState
            icon={<IconEmptyWallet size={52} />}
            title="还没有小荷包"
            hint="点上方「+ 新建小荷包」创建一个～"
          />
        ) : (
          <ul className="wallet-list">
            {sortedWallets.map((w) => {
              const spent = walletSpend(transactions, w.id, currentYm);
              const remain = Math.round((w.allocated - spent) * 100) / 100;
              const status = walletStatus(spent, w.allocated);
              return (
                <li key={w.id} className="wallet-card" style={{ ['--wallet-color' as string]: w.color }}>
                  <div className="wallet-card-head">
                    <span className="wallet-dot" aria-hidden />
                    <div className="wallet-card-title">
                      <strong>{w.name}</strong>
                      <span className="hint">
                        已用 {formatRmb(spent)} · 剩余 {formatRmb(remain)}
                      </span>
                    </div>
                    <div className="wallet-card-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(w)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          if (confirm(`删除「${w.name}」？相关流水会取消关联。`)) removeWallet(w.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <ProgressBar
                    label="本月进度"
                    used={spent}
                    budget={w.allocated}
                    status={status}
                    remainLabel
                  />
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      {adding && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="新建小荷包">
            <div className="modal-handle" />
            <h2 className="glass-title">新建小荷包</h2>
            <div className="field">
              <label>分配金额 (RMB)</label>
              <input
                inputMode="decimal"
                placeholder="例如 500"
                value={addAllocated}
                onChange={(e) => setAddAllocated(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={confirmAdd}>
                创建（自动命名上色）
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setAdding(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="编辑小荷包">
            <div className="modal-handle" />
            <h2 className="glass-title">编辑小荷包</h2>
            <div className="field section-gap">
              <label>名称</label>
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="field">
              <label>分配金额 (RMB)</label>
              <input
                inputMode="decimal"
                value={edit.allocated}
                onChange={(e) => setEdit({ ...edit, allocated: e.target.value })}
              />
            </div>
            <div className="field">
              <label>颜色</label>
              <div className="wallet-color-grid">
                {WALLET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`wallet-color-swatch ${edit.color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => setEdit({ ...edit, color: c })}
                  />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={saveEdit}>
                保存
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setEdit(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

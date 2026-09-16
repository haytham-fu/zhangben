import { useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { IconEmptyWallet } from '../components/CuteIcons';
import { GlassCard } from '../components/GlassCard';
import { ProgressBar } from '../components/ProgressBar';
import type { Store } from '../hooks/useStore';
import type { Bucket, Wallet } from '../types';
import { formatRmb } from '../utils/currency';
import { allocatedSum, unallocated, WALLET_COLORS, walletSpend, walletStatus } from '../utils/wallets';

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
  const [addBucket, setAddBucket] = useState<Bucket | null>(null);
  const [addAllocated, setAddAllocated] = useState('');

  const basicWallets = useMemo(
    () => wallets.filter((w) => w.bucket === 'basic').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [wallets],
  );
  const specialWallets = useMemo(
    () => wallets.filter((w) => w.bucket === 'special').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [wallets],
  );

  const basicFree = unallocated(settings, wallets, 'basic');
  const specialFree = unallocated(settings, wallets, 'special');

  function openEdit(w: Wallet) {
    setEdit({
      id: w.id,
      name: w.name,
      color: w.color,
      allocated: String(w.allocated),
    });
    setAddBucket(null);
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
    if (!addBucket) return;
    const n = addAllocated.trim() === '' ? 0 : parseFloat(addAllocated);
    if (Number.isNaN(n) || n < 0) {
      alert('请输入有效的分配金额');
      return;
    }
    addWallet(addBucket, n);
    setAddBucket(null);
    setAddAllocated('');
  }

  function renderSection(title: string, budget: number, list: Wallet[], bucket: Bucket, free: number) {
    const usedAlloc = allocatedSum(wallets, bucket);
    return (
      <GlassCard
        title={title}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setAddBucket(bucket);
              setAddAllocated('');
              setEdit(null);
            }}
          >
            + 新建
          </button>
        }
      >
        <div className="wallet-bucket-meta">
          <div className="stat-pill">
            <div className="k">预算</div>
            <div className="v">{formatRmb(budget)}</div>
          </div>
          <div className="stat-pill">
            <div className="k">已分配</div>
            <div className="v">{formatRmb(usedAlloc)}</div>
          </div>
          <div className="stat-pill">
            <div className="k">未分配</div>
            <div className={`v ${free < 0 ? 'neg' : ''}`}>{formatRmb(free)}</div>
          </div>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<IconEmptyWallet size={52} />}
            title="还没有小荷包"
            hint={`点「新建」从${bucket === 'basic' ? '基础 3500' : '专项 1500'}里分一块钱出来～`}
          />
        ) : (
          <ul className="wallet-list">
            {list.map((w) => {
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
    );
  }

  return (
    <>
      <GlassCard title="小荷包">
        <p className="hint" style={{ marginBottom: 0 }}>
          把基础 3500 / 专项 1500 拆成多个可爱荷包，记账时可选用。数据保存在本机。
        </p>
      </GlassCard>

      {renderSection('基础生活 · 3500', settings.basicBudget, basicWallets, 'basic', basicFree)}
      {renderSection('专项 · 1500', settings.specialBudget, specialWallets, 'special', specialFree)}

      {addBucket && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="新建小荷包">
            <div className="modal-handle" />
            <h2 className="glass-title">新建小荷包</h2>
            <p className="hint" style={{ marginBottom: 12 }}>
              {addBucket === 'basic' ? '基础生活' : '专项'} · 会自动起可爱名字和颜色，未分配{' '}
              {formatRmb(addBucket === 'basic' ? basicFree : specialFree)}
            </p>
            <div className="field">
              <label>分配金额 (RMB)</label>
              <input
                inputMode="decimal"
                placeholder="例如 500"
                value={addAllocated}
                onChange={(e) => setAddAllocated(e.target.value)}
                autoFocus
              />
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={confirmAdd}>
              创建（自动命名上色）
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block section-gap"
              onClick={() => setAddBucket(null)}
            >
              取消
            </button>
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
            <button type="button" className="btn btn-primary btn-block" onClick={saveEdit}>
              保存
            </button>
            <button type="button" className="btn btn-secondary btn-block section-gap" onClick={() => setEdit(null)}>
              取消
            </button>
          </div>
        </div>
      )}
    </>
  );
}

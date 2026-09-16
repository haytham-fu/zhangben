import { useMemo, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { ModalPortal } from '../components/ModalPortal';
import { PantryPanel } from '../components/PantryPanel';
import { ProgressBar } from '../components/ProgressBar';
import type { Store } from '../hooks/useStore';
import type { Wallet, WalletTransferSource } from '../types';
import { budgetStatus, filterMonth, netBasicSpend, specialSpend } from '../utils/budget';
import { formatRmb } from '../utils/currency';
import {
  isMonthSettled,
  isPigWallet,
  pickCuteName,
  pickWalletColor,
  settlementDelta,
  transferableRemain,
  WALLET_COLORS,
} from '../utils/wallets';

interface Props {
  store: Store;
}

type EditDraft = {
  id: string;
  name: string;
  color: string;
  target: string;
  isPig: boolean;
};

type TransferDraft = {
  walletId: string;
  name: string;
  direction: 'in' | 'out';
  amount: string;
  source: WalletTransferSource;
};

type AddDraft = {
  name: string;
  color: string;
};

export function WalletsPage({ store }: Props) {
  const {
    wallets,
    settings,
    transactions,
    currentYm,
    addWallet,
    updateWallet,
    removeWallet,
    transferWallet,
    settleMonth,
  } = store;

  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [adding, setAdding] = useState<AddDraft | null>(null);
  const [transfer, setTransfer] = useState<TransferDraft | null>(null);

  const pig = useMemo(() => wallets.find((w) => isPigWallet(w)) ?? null, [wallets]);
  const userWallets = useMemo(
    () =>
      [...wallets]
        .filter((w) => !isPigWallet(w))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [wallets],
  );

  const monthTxs = useMemo(() => filterMonth(transactions, currentYm), [transactions, currentYm]);
  const basicUsed = netBasicSpend(monthTxs, { includeSpecial: settings.includeSpecialInAdvice });
  const specialUsed = specialSpend(monthTxs, { includeSpecial: true });
  const totalBudget = settings.basicBudget + settings.specialBudget;
  const totalRemain = Math.round((totalBudget - basicUsed - specialUsed) * 100) / 100;
  const canTransfer = transferableRemain(settings, wallets, transactions, currentYm);
  const settled = isMonthSettled(settings, currentYm);
  const settlePreview = settlementDelta(settings, wallets, transactions, currentYm);

  function openEdit(w: Wallet) {
    setEdit({
      id: w.id,
      name: w.name,
      color: w.color,
      target: w.target != null && w.target > 0 ? String(w.target) : '',
      isPig: isPigWallet(w),
    });
    setAdding(null);
    setTransfer(null);
  }

  function saveEdit() {
    if (!edit) return;
    const targetRaw = edit.target.trim();
    let target: number | null = null;
    if (targetRaw !== '') {
      const n = parseFloat(targetRaw);
      if (Number.isNaN(n) || n < 0) {
        alert('请输入有效的目标金额（可留空）');
        return;
      }
      target = n;
    }
    updateWallet(edit.id, {
      name: edit.isPig ? undefined : edit.name.trim() || '小荷包',
      color: edit.color,
      target,
    });
    setEdit(null);
  }

  function openAdd() {
    setAdding({
      name: pickCuteName(wallets),
      color: pickWalletColor(wallets),
    });
    setEdit(null);
    setTransfer(null);
  }

  function confirmAdd() {
    if (!adding) return;
    addWallet({ name: adding.name.trim() || undefined, color: adding.color });
    setAdding(null);
  }

  function openTransfer(w: Wallet, direction: 'in' | 'out') {
    setTransfer({
      walletId: w.id,
      name: w.name,
      direction,
      amount: '',
      source: 'total',
    });
    setEdit(null);
    setAdding(null);
  }

  function confirmTransfer() {
    if (!transfer) return;
    const n = parseFloat(transfer.amount);
    if (Number.isNaN(n) || n <= 0) {
      alert('请输入有效金额');
      return;
    }
    const res = transferWallet(transfer.walletId, transfer.direction, n, transfer.source);
    if (!res.ok) {
      alert(res.message ?? '操作失败');
      return;
    }
    setTransfer(null);
  }

  function doSettle() {
    const tip =
      settlePreview > 0
        ? `将把本月盈余 ${formatRmb(settlePreview)} 转入小钱猪。确认结算？`
        : settlePreview < 0
          ? `本月超支 ${formatRmb(Math.abs(settlePreview))}，将从小钱猪扣除（余额可为负，表示欠小钱猪）。确认结算？`
          : '本月刚好花完，将标记为已结算。确认？';
    if (!confirm(tip)) return;
    const res = settleMonth(currentYm);
    alert(res.message);
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
        <p className="hint" style={{ marginBottom: 8 }}>
          创建时只需名称和颜色；从「本月总预算剩余」转入金额。记账时可关联小荷包扣减余额。
        </p>
        <div className="wallet-bucket-meta">
          <div className="stat-pill">
            <div className="k">本月总预算剩余</div>
            <div className={`v ${totalRemain < 0 ? 'neg' : ''}`}>{formatRmb(totalRemain)}</div>
          </div>
          <div className="stat-pill">
            <div className="k">可转余额</div>
            <div className={`v ${canTransfer < 0 ? 'neg' : ''}`}>{formatRmb(canTransfer)}</div>
          </div>
        </div>
      </GlassCard>

      {pig && (
        <GlassCard title="小钱猪（系统）">
          <div className="pig-hero" style={{ ['--wallet-color' as string]: pig.color }}>
            <div className="pig-hero-icon" aria-hidden>
              🐷
            </div>
            <div className="pig-hero-body">
              <strong className="pig-hero-name">{pig.name}</strong>
              <div className={`pig-hero-balance ${pig.balance < 0 ? 'debt' : ''}`}>
                {formatRmb(pig.balance)}
              </div>
              <p className="hint" style={{ margin: '4px 0 0' }}>
                {pig.balance < 0
                  ? '余额为负表示欠小钱猪（超支已记入）'
                  : '月末盈余转入 · 超支从这里扣'}
              </p>
            </div>
          </div>
          <div className="wallet-card-actions" style={{ marginTop: 10, justifyContent: 'stretch' }}>
            {settled ? (
              <span className="hint">本月（{currentYm}）已结算</span>
            ) : (
              <button type="button" className="btn btn-primary btn-block" onClick={doSettle}>
                月末结算
                {settlePreview !== 0
                  ? settlePreview > 0
                    ? `（盈余 ${formatRmb(settlePreview)}）`
                    : `（超支 ${formatRmb(Math.abs(settlePreview))}）`
                  : '（刚好）'}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(pig)}>
              编辑颜色/目标
            </button>
          </div>
          {pig.target != null && pig.target > 0 && (
            <div style={{ marginTop: 10 }}>
              <ProgressBar
                label="目标进度"
                used={Math.max(0, pig.balance)}
                budget={pig.target}
                status={budgetStatus(Math.max(0, pig.balance), pig.target)}
                remainLabel
              />
            </div>
          )}
          {(pig.transfers?.length ?? 0) > 0 && (
            <details className="pig-history" style={{ marginTop: 10 }}>
              <summary className="hint">最近结算 / 流水</summary>
              <ul className="pig-transfer-list">
                {(pig.transfers ?? []).slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <span>{t.note || (t.direction === 'in' ? '转入' : '转出')}</span>
                    <span className={t.direction === 'in' ? 'pos' : 'neg'}>
                      {t.direction === 'in' ? '+' : '-'}
                      {formatRmb(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </GlassCard>
      )}

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

      <PantryPanel store={store} />

      <GlassCard title="我的小荷包">
        {userWallets.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            还没有自建小荷包。点上方「新建」只需填名称和颜色，再用「转入」存钱。
          </p>
        ) : (
          <ul className="wallet-list">
            {userWallets.map((w) => {
              const saved = w.balance;
              return (
                <li key={w.id} className="wallet-card" style={{ ['--wallet-color' as string]: w.color }}>
                  <div className="wallet-card-head">
                    <span className="wallet-dot" aria-hidden />
                    <div className="wallet-card-title">
                      <strong>{w.name}</strong>
                      <span className="hint">已存 {formatRmb(saved)}</span>
                    </div>
                    <div className="wallet-card-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => openTransfer(w, 'in')}
                      >
                        转入
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openTransfer(w, 'out')}
                        disabled={w.balance <= 0}
                      >
                        转出
                      </button>
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
                  {w.target != null && w.target > 0 ? (
                    <ProgressBar
                      label="目标进度"
                      used={saved}
                      budget={w.target}
                      status={budgetStatus(saved, w.target)}
                      remainLabel
                    />
                  ) : (
                    <p className="hint" style={{ margin: '6px 0 0' }}>
                      可转余额 {formatRmb(canTransfer)} · 编辑可设目标
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      {adding && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation" onClick={() => setAdding(null)}>
            <div
              className="modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="新建小荷包"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <h2 className="glass-title">新建小荷包</h2>
              <p className="hint">只需名称和颜色；金额请创建后用「转入」从本月预算剩余存入。</p>
              <div className="field section-gap">
                <label>名称</label>
                <input
                  value={adding.name}
                  onChange={(e) => setAdding({ ...adding, name: e.target.value })}
                  placeholder="例如 奶茶基金"
                />
              </div>
              <div className="field">
                <label>颜色</label>
                <div className="wallet-color-grid">
                  {WALLET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`wallet-color-swatch ${adding.color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      aria-label={c}
                      onClick={() => setAdding({ ...adding, color: c })}
                    />
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-primary btn-block" onClick={confirmAdd}>
                  创建
                </button>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setAdding(null)}>
                  退出
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {transfer && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation" onClick={() => setTransfer(null)}>
            <div
              className="modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={transfer.direction === 'in' ? '转入小荷包' : '转出小荷包'}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <h2 className="glass-title">
                {transfer.direction === 'in' ? '转入' : '转出'} · {transfer.name}
              </h2>
              {transfer.direction === 'in' && (
                <div className="field section-gap">
                  <label>来源</label>
                  <div className="chip-row">
                    {(
                      [
                        ['total', '本月总预算剩余'],
                        ['basic', '基础剩余'],
                        ['special', '专项剩余'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`chip ${transfer.source === key ? 'active' : ''}`}
                        onClick={() => setTransfer({ ...transfer, source: key })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="hint" style={{ marginTop: 6 }}>
                    当前可转约 {formatRmb(canTransfer)}（总预算剩余扣去已存小荷包）
                  </p>
                </div>
              )}
              <div className="field">
                <label>金额 (RMB)</label>
                <input
                  inputMode="decimal"
                  placeholder="例如 200"
                  value={transfer.amount}
                  onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-primary btn-block" onClick={confirmTransfer}>
                  确认{transfer.direction === 'in' ? '转入' : '转出'}
                </button>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setTransfer(null)}>
                  退出
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {edit && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation" onClick={() => setEdit(null)}>
            <div
              className="modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="编辑小荷包"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <h2 className="glass-title">{edit.isPig ? '编辑小钱猪' : '编辑小荷包'}</h2>
              {!edit.isPig && (
                <div className="field section-gap">
                  <label>名称</label>
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </div>
              )}
              <div className="field">
                <label>目标金额（可选）</label>
                <input
                  inputMode="decimal"
                  placeholder="留空表示不设目标"
                  value={edit.target}
                  onChange={(e) => setEdit({ ...edit, target: e.target.value })}
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
                  退出
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

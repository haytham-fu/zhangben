import { useMemo, useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { GroceryKind, PaymentMethod } from '../types';
import { formatRmb } from '../utils/currency';
import {
  GROCERY_KIND_OPTIONS,
  activePantryItems,
  kindIcon,
  pantryRemainingValue,
} from '../utils/grocery';
import { AmountInput } from './AmountInput';
import { GlassCard } from './GlassCard';
import { ModalPortal } from './ModalPortal';
import { PaymentPicker } from './PaymentPicker';

interface Props {
  store: Store;
}

type BackfillDraft = {
  name: string;
  kind: GroceryKind;
  cost: number;
  meals: number;
  boughtDate: string;
  note: string;
  recordExpense: boolean;
  paymentMethod: PaymentMethod;
};

function emptyBackfill(today: string): BackfillDraft {
  return {
    name: '',
    kind: 'veg',
    cost: 0,
    meals: 0,
    boughtDate: today,
    note: '',
    recordExpense: false,
    paymentMethod: 'other',
  };
}

export function PantryPanel({ store }: Props) {
  const { pantryItems, removePantryItem, addPantryBackfill, todayStr, wallets } = store;
  const available = useMemo(() => activePantryItems(pantryItems), [pantryItems]);
  const remain = useMemo(() => pantryRemainingValue(available), [available]);
  const depleted = useMemo(
    () =>
      pantryItems
        .filter((p) => p.mealsLeft <= 0.001)
        .sort((a, b) => b.boughtDate.localeCompare(a.boughtDate))
        .slice(0, 8),
    [pantryItems],
  );

  const [backfill, setBackfill] = useState<BackfillDraft | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);

  function openBackfill() {
    setBackfill(emptyBackfill(todayStr));
    setWalletId(null);
  }

  function closeBackfill() {
    setBackfill(null);
    setWalletId(null);
  }

  function saveBackfill() {
    if (!backfill) return;
    const name = backfill.name.trim();
    if (!name) {
      alert('请填写食材名称');
      return;
    }
    if (!(backfill.meals > 0)) {
      alert('请填写大概能吃几顿（大于 0）');
      return;
    }
    if (backfill.recordExpense && !(backfill.cost > 0)) {
      alert('记过往支出时请填写金额');
      return;
    }
    addPantryBackfill({
      name,
      kind: backfill.kind,
      costRmb: backfill.cost,
      meals: backfill.meals,
      boughtDate: backfill.boughtDate || todayStr,
      note: backfill.note.trim() || undefined,
      recordExpense: backfill.recordExpense,
      paymentMethod: backfill.paymentMethod,
      walletId: backfill.recordExpense ? walletId : null,
    });
    closeBackfill();
  }

  const kindOptions: { kind: GroceryKind; label: string; icon: string }[] = [
    ...GROCERY_KIND_OPTIONS,
    { kind: 'custom', label: '其他', icon: '🛒' },
  ];

  return (
    <>
      <GlassCard title="冰箱 / 食材">
        <p className="hint" style={{ marginTop: 0 }}>
          记账 → 支出 → 吃饭 → 自己做饭 可购置与扣减。当前库存估值约 {formatRmb(remain)}。
        </p>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button type="button" className="chip chip-with-icon" onClick={openBackfill}>
            <span className="emoji-bubble" aria-hidden>
              📝
            </span>
            补登食材
          </button>
        </div>
        {available.length === 0 ? (
          <p className="hint">暂无可用食材。可点「补登食材」录入过往买的菜。</p>
        ) : (
          <ul className="pantry-inventory-list">
            {available.map((p) => (
              <li key={p.id} className="pantry-inventory-item">
                <span className="emoji-bubble" aria-hidden>
                  {kindIcon(p.kind)}
                </span>
                <div className="pantry-inventory-meta">
                  <strong>{p.name}</strong>
                  <span className="hint">
                    剩 {p.mealsLeft}/{p.mealsTotal} 顿 · 每顿 {formatRmb(p.costPerMeal)} ·{' '}
                    {p.boughtDate}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (confirm(`移除「${p.name}」？`)) removePantryItem(p.id);
                  }}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
        {depleted.length > 0 && (
          <>
            <p className="sheet-section-label section-gap">已用完（最近）</p>
            <ul className="pantry-inventory-list muted">
              {depleted.map((p) => (
                <li key={p.id} className="pantry-inventory-item">
                  <span className="emoji-bubble" aria-hidden>
                    {kindIcon(p.kind)}
                  </span>
                  <div className="pantry-inventory-meta">
                    <strong>{p.name}</strong>
                    <span className="hint">已用完 · {p.boughtDate}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removePantryItem(p.id)}
                  >
                    清除
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </GlassCard>

      {backfill && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation" onClick={closeBackfill}>
            <div
              className="modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="补登食材"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <h2 className="glass-title">补登食材</h2>
              <div className="modal-sheet-body">
                <p className="hint" style={{ marginTop: 0 }}>
                  把过往已买的食材直接写入冰箱，默认不记新支出。
                </p>

                <div className="field">
                  <label>名称</label>
                  <input
                    value={backfill.name}
                    onChange={(e) => setBackfill({ ...backfill, name: e.target.value })}
                    placeholder="例如：五花肉"
                    autoFocus
                  />
                </div>

                <p className="sheet-section-label" style={{ marginBottom: 6 }}>
                  品类
                </p>
                <div className="chip-row grocery-kind-row" style={{ marginBottom: 12 }}>
                  {kindOptions.map((k) => (
                    <button
                      key={k.kind}
                      type="button"
                      className={`chip chip-sm chip-with-icon ${
                        backfill.kind === k.kind ? 'active' : ''
                      }`}
                      onClick={() => setBackfill({ ...backfill, kind: k.kind })}
                    >
                      <span className="emoji-bubble">{k.icon}</span>
                      {k.label}
                    </button>
                  ))}
                </div>

                <div className="row-2">
                  <div className="field">
                    <label>花费（元）</label>
                    <AmountInput
                      step="0.01"
                      placeholder="RMB"
                      value={backfill.cost}
                      onValueChange={(n) => setBackfill({ ...backfill, cost: n })}
                    />
                  </div>
                  <div className="field">
                    <label>大概能吃几顿</label>
                    <AmountInput
                      step="0.1"
                      placeholder="顿"
                      value={backfill.meals}
                      onValueChange={(n) => setBackfill({ ...backfill, meals: n })}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>购买日期（可选）</label>
                  <input
                    type="date"
                    value={backfill.boughtDate}
                    onChange={(e) => setBackfill({ ...backfill, boughtDate: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>备注（可选）</label>
                  <input
                    value={backfill.note}
                    onChange={(e) => setBackfill({ ...backfill, note: e.target.value })}
                    placeholder="可选"
                  />
                </div>

                <div className="toggle-row section-gap">
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 650 }}>同时记一笔过往支出</div>
                    <p className="hint" style={{ margin: '4px 0 0' }}>
                      默认关闭：只补库存。开启后按上方日期记买菜支出并计入预算。
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`toggle ${backfill.recordExpense ? 'on' : ''}`}
                    aria-label="同时记一笔过往支出"
                    onClick={() =>
                      setBackfill({ ...backfill, recordExpense: !backfill.recordExpense })
                    }
                  />
                </div>

                {backfill.recordExpense && (
                  <>
                    <div className="field section-gap">
                      <label>支付方式</label>
                      <PaymentPicker
                        value={backfill.paymentMethod}
                        onChange={(m) => setBackfill({ ...backfill, paymentMethod: m })}
                        compact
                      />
                    </div>
                    {wallets.length > 0 && (
                      <div className="field">
                        <label>小荷包（可选）</label>
                        <div className="chip-row wallet-pick-row">
                          <button
                            type="button"
                            className={`chip ${walletId == null ? 'active' : ''}`}
                            onClick={() => setWalletId(null)}
                          >
                            不指定
                          </button>
                          {wallets.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              className={`chip chip-with-icon ${
                                walletId === w.id ? 'active' : ''
                              }`}
                              onClick={() => setWalletId(w.id)}
                            >
                              <span
                                className="wallet-chip-dot"
                                style={{ background: w.color }}
                                aria-hidden
                              />
                              {w.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-primary btn-block" onClick={saveBackfill}>
                  保存到冰箱
                </button>
                <button type="button" className="btn btn-ghost btn-block" onClick={closeBackfill}>
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

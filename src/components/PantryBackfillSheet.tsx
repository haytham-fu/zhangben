import { useEffect, useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { GroceryKind, PaymentMethod } from '../types';
import { GROCERY_KIND_OPTIONS } from '../utils/grocery';
import { AmountInput } from './AmountInput';
import { ModalPortal } from './ModalPortal';
import { PaymentPicker } from './PaymentPicker';

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

interface Props {
  store: Store;
  open: boolean;
  onClose: () => void;
}

export function PantryBackfillSheet({ store, open, onClose }: Props) {
  const { addPantryBackfill, todayStr, wallets } = store;
  const [draft, setDraft] = useState<BackfillDraft>(() => emptyBackfill(todayStr));
  const [walletId, setWalletId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(emptyBackfill(todayStr));
      setWalletId(null);
    }
  }, [open, todayStr]);

  function save() {
    const name = draft.name.trim();
    if (!name) {
      alert('请填写食材名称');
      return;
    }
    if (!(draft.meals > 0)) {
      alert('请填写大概能吃几顿（大于 0）');
      return;
    }
    if (draft.recordExpense && !(draft.cost > 0)) {
      alert('记过往支出时请填写金额');
      return;
    }
    addPantryBackfill({
      name,
      kind: draft.kind,
      costRmb: draft.cost,
      meals: draft.meals,
      boughtDate: draft.boughtDate || todayStr,
      note: draft.note.trim() || undefined,
      recordExpense: draft.recordExpense,
      paymentMethod: draft.paymentMethod,
      walletId: draft.recordExpense ? walletId : null,
    });
    onClose();
  }

  const kindOptions: { kind: GroceryKind; label: string; icon: string }[] = [
    ...GROCERY_KIND_OPTIONS,
    { kind: 'custom', label: '其他', icon: '🛒' },
  ];

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="presentation" onClick={onClose}>
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
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
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
                  className={`chip chip-sm chip-with-icon ${draft.kind === k.kind ? 'active' : ''}`}
                  onClick={() => setDraft({ ...draft, kind: k.kind })}
                >
                  <span className="emoji-bubble">{k.icon}</span>
                  {k.label}
                </button>
              ))}
            </div>

            <div className="row-2 grocery-cost-meals">
              <div className="field">
                <label>花费（元）</label>
                <AmountInput
                  step="0.01"
                  placeholder="RMB"
                  value={draft.cost}
                  onValueChange={(n) => setDraft({ ...draft, cost: n })}
                />
              </div>
              <div className="field">
                <label>大概能吃几顿</label>
                <AmountInput
                  step="0.1"
                  placeholder="顿"
                  value={draft.meals}
                  onValueChange={(n) => setDraft({ ...draft, meals: n })}
                />
              </div>
            </div>

            <div className="field">
              <label>购买日期（可选）</label>
              <input
                type="date"
                value={draft.boughtDate}
                onChange={(e) => setDraft({ ...draft, boughtDate: e.target.value })}
              />
            </div>

            <div className="field">
              <label>备注（可选）</label>
              <input
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
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
                className={`toggle ${draft.recordExpense ? 'on' : ''}`}
                aria-label="同时记一笔过往支出"
                onClick={() => setDraft({ ...draft, recordExpense: !draft.recordExpense })}
              />
            </div>

            {draft.recordExpense && (
              <>
                <div className="field section-gap">
                  <label>支付方式</label>
                  <PaymentPicker
                    value={draft.paymentMethod}
                    onChange={(m) => setDraft({ ...draft, paymentMethod: m })}
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
                          className={`chip chip-with-icon ${walletId === w.id ? 'active' : ''}`}
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
            <button type="button" className="btn btn-primary btn-block" onClick={save}>
              保存到冰箱
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
              退出
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

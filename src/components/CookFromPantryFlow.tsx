import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Store } from '../hooks/useStore';
import { formatRmb } from '../utils/currency';
import {
  activePantryItems,
  kindIcon,
  pantryRemainingValue,
  roundMoney,
} from '../utils/grocery';
import { GlassCard } from './GlassCard';
import { GroceryPurchaseFlow } from './GroceryPurchaseFlow';

interface Props {
  store: Store;
  onCancel: () => void;
  onDone: () => void;
}

export function CookFromPantryFlow({ store, onCancel, onDone }: Props) {
  const { pantryItems, todayStr, cookFromPantry, removePantryItem } = store;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBuy, setShowBuy] = useState(false);
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');

  const available = useMemo(() => activePantryItems(pantryItems), [pantryItems]);
  const remainValue = useMemo(() => pantryRemainingValue(available), [available]);

  const selectedItems = useMemo(
    () => available.filter((p) => selected.has(p.id)),
    [available, selected],
  );

  const total = useMemo(
    () => roundMoney(selectedItems.reduce((s, p) => s + p.costPerMeal, 0)),
    [selectedItems],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmCook() {
    if (selectedItems.length === 0) {
      alert('请先点选本次做饭用到的食材');
      return;
    }
    cookFromPantry({
      date,
      pantryIds: selectedItems.map((p) => p.id),
      note: note.trim() || undefined,
      paymentMethod: 'other',
    });
    onDone();
  }

  if (showBuy) {
    return (
      <GroceryPurchaseFlow
        store={store}
        onCancel={() => setShowBuy(false)}
        onDone={() => setShowBuy(false)}
      />
    );
  }

  const sticky =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="cook-sticky-bar" role="region" aria-label="做饭总价">
            <div className="cook-sticky-inner">
              <div className="cook-sticky-total">
                <span className="hint">本次总价（库存均摊）</span>
                <strong>{formatRmb(total)}</strong>
                {selectedItems.length > 0 && (
                  <span className="hint">· {selectedItems.length} 种食材</span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedItems.length === 0}
                onClick={confirmCook}
              >
                确认记录支出
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <GlassCard title="自己做饭" className="cook-from-pantry">
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" onClick={onCancel}>
            ← 返回
          </button>
          <button type="button" className="chip" onClick={onCancel}>
            退出
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setShowBuy(true)}
        >
          添加食材购置支出
        </button>
        <p className="hint" style={{ marginTop: 8 }}>
          买菜写入冰箱；点选本次要用的食材。库存估值约 {formatRmb(remainValue)}。
        </p>

        <div className="field section-gap">
          <label>日期</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <p className="sheet-section-label section-gap">当前可用食材</p>
        {available.length === 0 ? (
          <p className="hint">冰箱空空的，请先添加食材购置支出</p>
        ) : (
          <ul className="pantry-pick-list">
            {available.map((p) => {
              const on = selected.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`pantry-pick-btn ${on ? 'active' : ''}`}
                    onClick={() => toggle(p.id)}
                  >
                    <span className="pantry-pick-main">
                      <span className="emoji-bubble" aria-hidden>
                        {kindIcon(p.kind)}
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <span className="hint">
                          剩 {p.mealsLeft}/{p.mealsTotal} 顿 · 每顿约 {formatRmb(p.costPerMeal)}
                        </span>
                      </span>
                    </span>
                    <span className={`pantry-check ${on ? 'on' : ''}`} aria-hidden>
                      {on ? '✓' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm pantry-del"
                    onClick={() => {
                      if (confirm(`从库存移除「${p.name}」？`)) {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          next.delete(p.id);
                          return next;
                        });
                        removePantryItem(p.id);
                      }
                    }}
                  >
                    移除
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="field section-gap">
          <label>备注</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可选，如：番茄炒蛋"
          />
        </div>

        <div className="cook-sticky-spacer" aria-hidden />
      </GlassCard>
      {sticky}
    </>
  );
}

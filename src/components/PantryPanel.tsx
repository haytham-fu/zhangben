import { useMemo } from 'react';
import type { Store } from '../hooks/useStore';
import { formatRmb } from '../utils/currency';
import { activePantryItems, kindIcon, pantryRemainingValue } from '../utils/grocery';
import { GlassCard } from './GlassCard';

interface Props {
  store: Store;
}

export function PantryPanel({ store }: Props) {
  const { pantryItems, removePantryItem } = store;
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

  return (
    <GlassCard title="冰箱 / 食材">
      <p className="hint" style={{ marginTop: 0 }}>
        记账 → 支出 → 吃饭 → 自己做饭 可购置与扣减。当前库存估值约 {formatRmb(remain)}。
      </p>
      {available.length === 0 ? (
        <p className="hint">暂无可用食材</p>
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
                  剩 {p.mealsLeft}/{p.mealsTotal} 顿 · 每顿 {formatRmb(p.costPerMeal)} · {p.boughtDate}
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
  );
}

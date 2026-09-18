import { useEffect, useMemo, useRef, useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { GroceryKind } from '../types';
import {
  defaultUnit,
  estimateFromCapacity,
  type CapUnit,
} from '../utils/capacityEstimate';
import { GROCERY_KIND_OPTIONS, resolveBackfillCapacityProfile } from '../utils/grocery';
import { AmountInput } from './AmountInput';
import { CapacityEstimatePanel } from './CapacityEstimatePanel';
import { ModalPortal } from './ModalPortal';

type RemainMode = 'meals' | 'capacity';

type BackfillDraft = {
  name: string;
  kind: GroceryKind;
  meals: number;
  note: string;
  remainMode: RemainMode;
  capacityRaw: string;
  capacityUnit: CapUnit;
};

function emptyBackfill(): BackfillDraft {
  return {
    name: '',
    kind: 'veg',
    meals: 0,
    note: '',
    remainMode: 'meals',
    capacityRaw: '',
    capacityUnit: 'g',
  };
}

const KIND_CHIP_OPTIONS: { kind: GroceryKind; label: string; icon: string }[] = [
  ...GROCERY_KIND_OPTIONS,
  { kind: 'custom', label: '其他', icon: '🛒' },
];

function chipLabel(kind: GroceryKind): string {
  return KIND_CHIP_OPTIONS.find((k) => k.kind === kind)?.label ?? kind;
}

function mealsFromCapacity(
  kind: GroceryKind,
  name: string,
  raw: string,
  unit: CapUnit,
): number {
  const ctx = resolveBackfillCapacityProfile(kind, name);
  if (!ctx.profile) return 0;
  const amt = parseFloat(raw);
  if (!Number.isFinite(amt) || amt <= 0) return 0;
  return estimateFromCapacity(ctx.profile, amt, unit)?.count ?? 0;
}

interface Props {
  store: Store;
  open: boolean;
  onClose: () => void;
}

export function PantryBackfillSheet({ store, open, onClose }: Props) {
  const { addPantryBackfill } = store;
  const [draft, setDraft] = useState<BackfillDraft>(() => emptyBackfill());
  /** Last name we auto-filled from a kind chip; used so custom typed names are preserved. */
  const autoFilledNameRef = useRef('');

  useEffect(() => {
    if (open) {
      setDraft(emptyBackfill());
      autoFilledNameRef.current = '';
    }
  }, [open]);

  const capacityCtx = useMemo(
    () => resolveBackfillCapacityProfile(draft.kind, draft.name),
    [draft.kind, draft.name],
  );

  const liveEst = useMemo(() => {
    if (draft.remainMode !== 'capacity' || !capacityCtx.profile) return null;
    const amt = parseFloat(draft.capacityRaw);
    if (!Number.isFinite(amt) || amt <= 0) return null;
    return estimateFromCapacity(capacityCtx.profile, amt, draft.capacityUnit);
  }, [draft.remainMode, draft.capacityRaw, draft.capacityUnit, capacityCtx.profile]);

  function setKind(kind: GroceryKind) {
    const label = chipLabel(kind);
    const trimmed = draft.name.trim();
    const shouldAutofill =
      !trimmed || trimmed === autoFilledNameRef.current;
    const nextName = shouldAutofill ? label : draft.name;
    if (shouldAutofill) autoFilledNameRef.current = label;

    const ctx = resolveBackfillCapacityProfile(kind, nextName);
    const unit = ctx.profile ? defaultUnit(ctx.profile) : 'g';
    const meals =
      draft.remainMode === 'capacity'
        ? mealsFromCapacity(kind, nextName, draft.capacityRaw, unit)
        : draft.meals;
    setDraft({ ...draft, kind, name: nextName, capacityUnit: unit, meals });
  }

  function applyCapacity(raw: string, unit: CapUnit, name?: string) {
    const nextName = name ?? draft.name;
    const meals = mealsFromCapacity(draft.kind, nextName, raw, unit);
    setDraft({
      ...draft,
      name: nextName,
      capacityRaw: raw,
      capacityUnit: unit,
      meals,
    });
  }

  function save() {
    const name = draft.name.trim() || chipLabel(draft.kind);
    if (!(draft.meals > 0)) {
      alert(
        draft.remainMode === 'capacity'
          ? '请填写剩余克/毫升，或切换为「大约还能吃几顿」'
          : '请填写大概还能吃几顿（大于 0）',
      );
      return;
    }
    addPantryBackfill({
      name,
      kind: draft.kind,
      meals: draft.meals,
      note: draft.note.trim() || undefined,
    });
    onClose();
  }

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
              只写入冰箱库存，不记金额与支出。点选品类即可，名称可空；也可手填还能吃几顿，或写剩余克/毫升由网站估算。
            </p>

            <div className="field">
              <label>名称</label>
              <input
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  if (draft.remainMode === 'capacity' && draft.kind === 'seasoning') {
                    applyCapacity(draft.capacityRaw, draft.capacityUnit, name);
                  } else {
                    setDraft({ ...draft, name });
                  }
                }}
                placeholder="点选品类即可，名称可空"
              />
            </div>

            <p className="sheet-section-label" style={{ marginBottom: 6 }}>
              品类
            </p>
            <div className="chip-row grocery-kind-row" style={{ marginBottom: 12 }}>
              {KIND_CHIP_OPTIONS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  className={`chip chip-sm chip-with-icon ${draft.kind === k.kind ? 'active' : ''}`}
                  onClick={() => setKind(k.kind)}
                >
                  <span className="emoji-bubble">{k.icon}</span>
                  {k.label}
                </button>
              ))}
            </div>

            <p className="sheet-section-label" style={{ marginBottom: 6 }}>
              还剩多少
            </p>
            <div className="chip-row" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={`chip chip-sm ${draft.remainMode === 'meals' ? 'active' : ''}`}
                onClick={() => setDraft({ ...draft, remainMode: 'meals' })}
              >
                大约还能吃几顿
              </button>
              <button
                type="button"
                className={`chip chip-sm ${draft.remainMode === 'capacity' ? 'active' : ''}`}
                onClick={() => {
                  const ctx = resolveBackfillCapacityProfile(draft.kind, draft.name);
                  const unit = ctx.profile ? defaultUnit(ctx.profile) : 'g';
                  setDraft({
                    ...draft,
                    remainMode: 'capacity',
                    capacityUnit: unit,
                  });
                }}
              >
                拿不准：写剩余克/毫升
              </button>
            </div>

            {draft.remainMode === 'meals' ? (
              <div className="field">
                <label>大约还能吃几顿</label>
                <AmountInput
                  step="0.1"
                  placeholder="顿"
                  value={draft.meals}
                  onValueChange={(n) => setDraft({ ...draft, meals: n })}
                />
              </div>
            ) : (
              <>
                {capacityCtx.profile ? (
                  <CapacityEstimatePanel
                    profile={capacityCtx.profile}
                    capacityRaw={draft.capacityRaw}
                    capacityUnit={draft.capacityUnit}
                    onCapacityChange={(raw, unit) => applyCapacity(raw, unit)}
                    profiles={capacityCtx.pickerProfiles}
                    selectedName={
                      capacityCtx.showPicker ? capacityCtx.profile.name : undefined
                    }
                    onSelectProfile={
                      capacityCtx.showPicker
                        ? (p) => {
                            const unit = defaultUnit(p);
                            applyCapacity(draft.capacityRaw || '1', unit, p.name);
                          }
                        : undefined
                    }
                    footerHint={
                      capacityCtx.showPicker
                        ? '可点选调料品名；估算可手动改顿数'
                        : '粗略按品类估算；也可切回「大约还能吃几顿」手填'
                    }
                  />
                ) : (
                  <p className="hint">请选择品类后再填剩余量</p>
                )}
                {(liveEst || draft.meals > 0) && (
                  <div className="field section-gap">
                    <label>估算顿数（可改）</label>
                    <AmountInput
                      step="0.1"
                      placeholder="顿"
                      value={draft.meals}
                      onValueChange={(n) => setDraft({ ...draft, meals: n })}
                    />
                  </div>
                )}
              </>
            )}

            <div className="field">
              <label>备注（可选）</label>
              <input
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="可选"
              />
            </div>
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

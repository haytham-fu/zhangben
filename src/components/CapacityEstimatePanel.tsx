import type { CapUnit, ProductProfile } from '../utils/capacityEstimate';
import { AmountInput } from './AmountInput';
import {
  defaultUnit,
  estimateFromCapacity,
  unitLabel,
} from '../utils/capacityEstimate';

interface Props {
  profile: ProductProfile | null;
  capacityRaw: string;
  capacityUnit: CapUnit;
  onCapacityChange: (raw: string, unit: CapUnit) => void;
  /** Optional: show profile name picker chips */
  profiles?: ProductProfile[];
  selectedName?: string;
  onSelectProfile?: (p: ProductProfile) => void;
  /** Extra hint under estimate */
  footerHint?: string;
}

export function CapacityEstimatePanel({
  profile,
  capacityRaw,
  capacityUnit,
  onCapacityChange,
  profiles,
  selectedName,
  onSelectProfile,
  footerHint,
}: Props) {
  const amount = parseFloat(capacityRaw);
  const est =
    profile && Number.isFinite(amount) && amount > 0
      ? estimateFromCapacity(profile, amount, capacityUnit)
      : null;

  const units = profile?.units ?? ['ml', 'L', 'g', 'kg', '勺', '瓶'];

  return (
    <div className="capacity-panel">
      {profiles && profiles.length > 0 && onSelectProfile && (
        <>
          <p className="sheet-section-label" style={{ marginBottom: 6 }}>
            点选品名
          </p>
          <div className="chip-row grocery-kind-row">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip chip-sm ${selectedName === p.name ? 'active' : ''}`}
                onClick={() => onSelectProfile(p)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      {profile && (
        <>
          <p className="sheet-section-label section-gap" style={{ marginBottom: 6 }}>
            容量 / 用量
          </p>
          <div className="row-2" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>数量</label>
              <AmountInput
                step="any"
                placeholder={
                  capacityUnit === '瓶' || capacityUnit === '支' || capacityUnit === '袋'
                    ? '例如 1'
                    : profile.base === 'ml'
                      ? '例如 500'
                      : '例如 400'
                }
                value={
                  Number.isFinite(parseFloat(capacityRaw)) ? parseFloat(capacityRaw) : 0
                }
                onValueChange={(n) => onCapacityChange(String(n), capacityUnit)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>单位</label>
              <select
                value={capacityUnit}
                onChange={(e) =>
                  onCapacityChange(capacityRaw, e.target.value as CapUnit)
                }
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(u)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(capacityUnit === '瓶' || capacityUnit === '支' || capacityUnit === '袋') && (
            <p className="hint" style={{ marginTop: 4 }}>
              建议装量按约 {profile.packSize}
              {profile.base} / {capacityUnit === '支' ? '支' : capacityUnit === '袋' ? '袋' : '瓶'}{' '}
              估算
            </p>
          )}
          {est ? (
            <p className="capacity-estimate-line">{est.label}</p>
          ) : (
            <p className="hint" style={{ marginTop: 6 }}>
              填写容量后显示粗略保守估算
            </p>
          )}
          {footerHint && (
            <p className="hint" style={{ marginTop: 2 }}>
              {footerHint}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export { defaultUnit };

import { useMemo, useState } from 'react';
import type { Store } from '../hooks/useStore';
import type { GroceryKind, PaymentMethod } from '../types';
import type { CapUnit } from '../utils/capacityEstimate';
import {
  defaultUnit,
  estimateFromCapacity,
  findProductProfile,
  seasoningProfiles,
} from '../utils/capacityEstimate';
import { formatRmb } from '../utils/currency';
import {
  GROCERY_KIND_OPTIONS,
  costPerMeal,
  estimateSeasoningMeals,
  kindIcon,
  purchaseCostPerMeal,
  purchaseMaxMeals,
  purchaseTotalCost,
  roundMoney,
} from '../utils/grocery';
import { PAYMENT_LABEL } from '../utils/payment';
import { CapacityEstimatePanel } from './CapacityEstimatePanel';
import { IconPayment } from './CuteIcons';
import { GlassCard } from './GlassCard';
import { ModalPortal } from './ModalPortal';

interface DraftItem {
  key: string;
  kind: GroceryKind;
  name: string;
  costRaw: string;
  mealsRaw: string;
  /** Seasoning capacity */
  capacityRaw: string;
  capacityUnit: CapUnit;
  /** User manually edited meal count */
  mealsManual: boolean;
}

interface Props {
  store: Store;
  onCancel: () => void;
  onDone: () => void;
}

let draftKey = 0;
function nextKey() {
  draftKey += 1;
  return `g-${draftKey}`;
}

function emptyDraft(kind: GroceryKind, name: string): DraftItem {
  const profile = kind === 'seasoning' ? findProductProfile(name) : null;
  const unit = profile ? defaultUnit(profile) : '瓶';
  let mealsRaw = '';
  if (kind === 'seasoning' && profile) {
    const est = estimateFromCapacity(profile, 1, unit);
    if (est) mealsRaw = String(est.count);
  }
  return {
    key: nextKey(),
    kind,
    name,
    costRaw: '',
    mealsRaw,
    capacityRaw: kind === 'seasoning' ? '1' : '',
    capacityUnit: unit,
    mealsManual: false,
  };
}

export function GroceryPurchaseFlow({ store, onCancel, onDone }: Props) {
  const { todayStr, wallets, addGroceryPurchase } = store;
  const [step, setStep] = useState<'items' | 'payment' | 'summary'>('items');
  const [date, setDate] = useState(todayStr);
  const [aaHalf, setAaHalf] = useState(false);
  const [customName, setCustomName] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('other');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  function addKind(kind: GroceryKind, name?: string) {
    const label =
      name?.trim() ||
      GROCERY_KIND_OPTIONS.find((k) => k.kind === kind)?.label ||
      '食材';
    setItems((prev) => [...prev, emptyDraft(kind, label)]);
  }

  function addCustom() {
    const n = customName.trim();
    if (!n) {
      alert('请输入自定义品名');
      return;
    }
    addKind('custom', n);
    setCustomName('');
  }

  function addSeasoningNamed(name: string) {
    setItems((prev) => [...prev, emptyDraft('seasoning', name)]);
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function applySeasoningCapacity(key: string, capacityRaw: string, capacityUnit: CapUnit, name: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, capacityRaw, capacityUnit, name: name || it.name };
        if (!it.mealsManual) {
          const est = estimateSeasoningMeals(next.name, parseFloat(capacityRaw), capacityUnit);
          if (est != null) next.mealsRaw = String(est);
        }
        return next;
      }),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  const parsed = useMemo(() => {
    return items.map((it) => {
      const rawCost = parseFloat(it.costRaw);
      const rawMeals = parseFloat(it.mealsRaw);
      const gross = Number.isFinite(rawCost) && rawCost > 0 ? rawCost : 0;
      const costRmb = aaHalf ? roundMoney(gross / 2) : roundMoney(gross);
      const meals = Number.isFinite(rawMeals) && rawMeals > 0 ? rawMeals : 0;
      const profile = it.kind === 'seasoning' ? findProductProfile(it.name) : null;
      const capAmt = parseFloat(it.capacityRaw);
      const liveEst =
        profile && Number.isFinite(capAmt) && capAmt > 0
          ? estimateFromCapacity(profile, capAmt, it.capacityUnit)
          : null;
      return {
        ...it,
        gross,
        costRmb,
        meals,
        perMeal: meals > 0 ? costPerMeal(costRmb, meals) : 0,
        liveEst,
        profile,
      };
    });
  }, [items, aaHalf]);

  const validItems = parsed.filter((it) => it.costRmb > 0 && it.meals > 0);
  const totalCost = purchaseTotalCost(validItems);
  const perMealSum = purchaseCostPerMeal(validItems);
  const maxMeals = purchaseMaxMeals(validItems);
  const totalOverMax = maxMeals > 0 ? roundMoney(totalCost / maxMeals) : 0;

  function goPayment() {
    if (validItems.length === 0) {
      alert('请至少添加一项，并填写「我实际出的钱」和「大约可吃几顿」');
      return;
    }
    if (parsed.some((it) => it.gross > 0 && it.meals <= 0)) {
      alert('有品类填了金额但未填顿数');
      return;
    }
    setPayOpen(true);
  }

  function confirmPayment(m: PaymentMethod) {
    setPaymentMethod(m);
    setPayOpen(false);
    setStep('summary');
  }

  function save() {
    if (validItems.length === 0) {
      alert('没有可保存的品类');
      return;
    }
    addGroceryPurchase({
      date,
      paymentMethod,
      walletId,
      note: note.trim() || undefined,
      items: validItems.map((it) => ({
        name: it.name,
        kind: it.kind,
        costRmb: it.costRmb,
        meals: it.meals,
      })),
    });
    onDone();
  }

  const seasoningList = seasoningProfiles();

  return (
    <>
      <GlassCard title="买菜支出">
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" onClick={onCancel}>
            ← 返回
          </button>
          {step !== 'items' && (
            <button type="button" className="chip" onClick={() => setStep('items')}>
              改品类
            </button>
          )}
          <button type="button" className="chip" onClick={onCancel}>
            退出
          </button>
        </div>

        {step === 'items' && (
          <>
            <div className="field">
              <label>日期</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="toggle-row section-gap">
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 650 }}>已和室友AA对半</div>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  开启后，下方金额按半计入「我实际出的钱」
                </p>
              </div>
              <button
                type="button"
                className={`toggle ${aaHalf ? 'on' : ''}`}
                aria-label="已和室友AA对半"
                onClick={() => setAaHalf((v) => !v)}
              />
            </div>

            <p className="sheet-section-label section-gap">点选买了什么</p>
            <div className="chip-row grocery-kind-row">
              {GROCERY_KIND_OPTIONS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  className="chip chip-with-icon"
                  onClick={() => addKind(k.kind)}
                >
                  <span className="emoji-bubble">{k.icon}</span>
                  {k.label}
                </button>
              ))}
            </div>

            <div className="row-2 section-gap" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>自定义品名</label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="例如：豆腐"
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={addCustom}>
                添加
              </button>
            </div>

            <p className="sheet-section-label section-gap">常用调料</p>
            <p className="hint" style={{ marginTop: -4 }}>
              点选后填写容量，自动估算可吃顿数（可改）
            </p>
            <div className="chip-row grocery-kind-row">
              {seasoningList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip chip-sm"
                  onClick={() => addSeasoningNamed(s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {items.length === 0 ? (
              <p className="hint section-gap">点选上方品类添加</p>
            ) : (
              <ul className="grocery-draft-list section-gap">
                {parsed.map((it) => (
                  <li key={it.key} className="grocery-draft-card">
                    <div className="grocery-draft-head">
                      <strong>
                        <span aria-hidden>{kindIcon(it.kind)}</span> {it.name}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeItem(it.key)}
                      >
                        删除
                      </button>
                    </div>
                    {(it.kind === 'custom' || it.kind === 'seasoning') && (
                      <div className="field">
                        <label>品名</label>
                        <input
                          value={it.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            if (it.kind === 'seasoning') {
                              applySeasoningCapacity(it.key, it.capacityRaw, it.capacityUnit, name);
                            } else {
                              updateItem(it.key, { name });
                            }
                          }}
                        />
                      </div>
                    )}

                    {it.kind === 'seasoning' && (
                      <CapacityEstimatePanel
                        profile={it.profile}
                        capacityRaw={it.capacityRaw}
                        capacityUnit={it.capacityUnit}
                        onCapacityChange={(raw, unit) =>
                          applySeasoningCapacity(it.key, raw, unit, it.name)
                        }
                        profiles={seasoningList}
                        selectedName={it.profile?.name}
                        onSelectProfile={(p) => {
                          applySeasoningCapacity(it.key, it.capacityRaw || '1', defaultUnit(p), p.name);
                        }}
                        footerHint="可在下方手动改顿数"
                      />
                    )}

                    <div className="row-2">
                      <div className="field">
                        <label>{aaHalf ? '购入总额（对半前）' : '我实际出的钱'}</label>
                        <input
                          inputMode="decimal"
                          placeholder="RMB"
                          value={it.costRaw}
                          onChange={(e) => updateItem(it.key, { costRaw: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>大约可吃几顿</label>
                        <input
                          inputMode="decimal"
                          placeholder="顿"
                          value={it.mealsRaw}
                          onChange={(e) =>
                            updateItem(it.key, { mealsRaw: e.target.value, mealsManual: true })
                          }
                        />
                      </div>
                    </div>
                    {aaHalf && it.gross > 0 && (
                      <p className="hint" style={{ marginTop: -6 }}>
                        我实际出的钱 ≈ {formatRmb(it.costRmb)}
                        {it.meals > 0 ? ` · 每顿约 ${formatRmb(it.perMeal)}` : ''}
                      </p>
                    )}
                    {!aaHalf && it.costRmb > 0 && it.meals > 0 && (
                      <p className="hint" style={{ marginTop: -6 }}>
                        每顿约 {formatRmb(it.perMeal)}
                      </p>
                    )}
                    {it.kind === 'seasoning' && it.liveEst && (
                      <p className="capacity-estimate-line" style={{ marginTop: 4 }}>
                        {it.liveEst.label}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {validItems.length > 0 && (
              <div className="grocery-summary-pill section-gap">
                <div>
                  合计 <strong>{formatRmb(totalCost)}</strong>
                  {aaHalf ? '（已 AA 对半）' : ''}
                </div>
                <div>
                  每顿均价约 <strong>{formatRmb(perMealSum)}</strong>
                  <span className="hint">（各品金额÷顿数后相加）</span>
                </div>
                {maxMeals > 0 && (
                  <div className="hint">
                    参考：总价÷最长可吃 {maxMeals} 顿 ≈ {formatRmb(totalOverMax)}/顿
                  </div>
                )}
              </div>
            )}

            <button type="button" className="btn btn-primary btn-block section-gap" onClick={goPayment}>
              下一步：选支付方式
            </button>
          </>
        )}

        {step === 'summary' && (
          <>
            <div className="wizard-summary section-gap">
              <button type="button" className="chip chip-with-icon" onClick={() => setStep('items')}>
                <span className="emoji-bubble">🥬</span>
                买菜 {validItems.length} 项
              </button>
              <button type="button" className="chip chip-with-icon" onClick={() => setPayOpen(true)}>
                <IconPayment method={paymentMethod} size={18} />
                {PAYMENT_LABEL[paymentMethod]}
              </button>
            </div>

            <div className="grocery-summary-pill">
              <div>
                我实际出的钱合计 <strong>{formatRmb(totalCost)}</strong>
              </div>
              <div>
                每顿均价约 <strong>{formatRmb(perMealSum)}</strong>
              </div>
              <ul className="grocery-summary-lines">
                {validItems.map((it) => (
                  <li key={it.key}>
                    {kindIcon(it.kind)} {it.name} · {formatRmb(it.costRmb)} / {it.meals} 顿 · 约{' '}
                    {formatRmb(it.perMeal)}/顿
                  </li>
                ))}
              </ul>
            </div>

            <div className="field section-gap">
              <label>备注</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
            </div>

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
                    <span className="wallet-chip-dot" style={{ background: w.color }} aria-hidden />
                    {w.name}
                  </button>
                ))}
              </div>
            </div>

            <p className="hint">保存后会写入「冰箱/食材」库存，做饭时可勾选扣减。</p>

            <button type="button" className="btn btn-primary btn-block" onClick={save}>
              保存买菜支出
            </button>
            <button type="button" className="btn btn-ghost btn-block section-gap" onClick={() => setStep('items')}>
              返回修改
            </button>
          </>
        )}
      </GlassCard>

      {payOpen && (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation" onClick={() => setPayOpen(false)}>
            <div
              className="modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="选择扣款方法"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <h2 className="glass-title">选择扣款方法</h2>
              <div className="modal-sheet-body">
              <div className="pay-sheet-grid">
                {(['octopus', 'alipay', 'wechat', 'bank', 'credit', 'other'] as PaymentMethod[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      className={`pay-sheet-btn ${paymentMethod === m ? 'active' : ''}`}
                      onClick={() => confirmPayment(m)}
                    >
                      <IconPayment method={m} size={28} />
                      <span>{PAYMENT_LABEL[m]}</span>
                    </button>
                  ),
                )}
              </div>
              </div>
              <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => setPayOpen(false)}
              >
                返回
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => {
                  setPayOpen(false);
                  onCancel();
                }}
              >
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

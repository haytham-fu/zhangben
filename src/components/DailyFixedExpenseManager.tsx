import { useState } from 'react';
import type { Store } from '../hooks/useStore';
import { useExpenseRates } from '../hooks/useExpenseRates';
import type { Currency, DailyFixedExpense } from '../types';
import { CURRENCY_META, formatMoney, formatRmb, orderedCurrenciesForPicker, toRmbWithRate } from '../utils/currency';
import { nextScheduledChargeDate } from '../utils/dailyFixed';
import { localDateStr } from '../utils/dates';
import { GlassCard } from './GlassCard';

interface Props { store: Store; onBack: () => void }
type Frequency = 'daily' | 'weekly' | 'monthly';
const cadence: Record<Frequency, string> = { daily: '每天', weekly: '每周', monthly: '每月' };

export function DailyFixedExpenseManager({ store, onBack }: Props) {
  const { categories, settings, todayStr, addDailyFixedExpense, updateDailyFixedExpense, stopDailyFixedExpense } = store;
  const choices = categories.filter((c) => !c.id.startsWith('income_') && !['octopus_topup', 'groceries', 'membership'].includes(c.id));
  const rules = (settings.dailyFixedExpenses ?? []).filter((r) => !r.stoppedOn);
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('RMB');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [categoryId, setCategoryId] = useState(choices.find((c) => c.id === 'ac')?.id ?? choices[0]?.id ?? 'ac');
  const [startDate, setStartDate] = useState(todayStr);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const fx = useExpenseRates([currency], settings);
  const chosen = choices.find((c) => c.id === categoryId);
  const selected = rules.find((r) => r.id === selectedId);

  function openNew() {
    setEditingId(null); setName(''); setAmount(''); setCurrency('RMB'); setFrequency('daily');
    setCategoryId(choices.find((c) => c.id === 'ac')?.id ?? choices[0]?.id ?? 'ac');
    setStartDate(localDateStr()); setError(''); setView('form');
  }
  function openEdit(rule: DailyFixedExpense) {
    setEditingId(rule.id); setName(rule.name); setAmount(String(rule.amount ?? rule.amountRmb));
    setCurrency(rule.currency ?? 'RMB'); setFrequency(rule.frequency ?? 'daily'); setCategoryId(rule.categoryId);
    setStartDate(nextScheduledChargeDate(rule, localDateStr()) ?? localDateStr());
    setError(''); setView('form');
  }
  function save() {
    const n = Number(amount);
    const today = localDateStr();
    if (!name.trim() || !chosen || !Number.isFinite(n) || n < 0.01 || n > 1_000_000) {
      setError('请填写名称和有效金额'); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < today) {
      setError('请选择今天或之后的首次记录日期'); return;
    }
    if (!fx.ready) { setError('汇率尚未就绪，请稍后重试'); return; }
    const input = { name: name.trim(), amount: n, currency, rate: fx.rateFor(currency),
      frequency, categoryId: chosen.id, bucket: chosen.bucket };
    if (editingId) {
      updateDailyFixedExpense(editingId, input, startDate);
      setFeedback('已保存修改；过去的支出记录保留');
    } else {
      addDailyFixedExpense(input, startDate);
      setFeedback('已添加定时支出');
    }
    setView('list'); setSelectedId(null); setEditingId(null); setError('');
  }
  function deleteSelected() {
    if (!selected) return;
    stopDailyFixedExpense(selected.id);
    setFeedback(`已删除「${selected.name}」的定时规则；过去的记录保留`);
    setConfirmDelete(false); setSelectedId(null); setView('list');
  }
  return <GlassCard title="设置／删除定时支出">
    {view === 'list' && <>
      <p className="hint" style={{ marginTop: 0 }}>设置后，账本会在每天、每周或每月的指定日期自动记录；关闭网站期间的记录会在下次打开时补齐。这不是银行自动扣款。</p>
      {feedback && <p className="save-success" role="status">✓ {feedback}</p>}
      {rules.length ? <div className="fixed-rule-list">{rules.map((rule) => {
        const next = nextScheduledChargeDate(rule, todayStr);
        return <button type="button" className="fixed-rule-card" key={rule.id} onClick={() => {
          setSelectedId(rule.id); setConfirmDelete(false); setView('detail');
        }}>
          <span className="fixed-rule-main"><strong>{rule.name}</strong><span>{cadence[rule.frequency ?? 'daily']} · {rule.bucket === 'special' ? '1500 专项' : '3500 基础'}</span></span>
          <span className="fixed-rule-money">{formatRmb(rule.amountRmb)}<small>{next ? `下次 ${next}` : '暂无下次日期'}</small></span>
        </button>;
      })}</div> : <p className="hint">还没有定时支出。</p>}
      <button type="button" className="btn btn-primary btn-block section-gap" onClick={openNew}>＋ 增加定时支出</button>
      <button type="button" className="btn btn-secondary btn-block section-gap" onClick={onBack}>返回支出</button>
    </>}
    {view === 'detail' && selected && <>
      <button type="button" className="chip" onClick={() => setView('list')}>← 返回列表</button>
      <div className="grocery-summary-pill section-gap">
        <strong>{selected.name} · {formatRmb(selected.amountRmb)}</strong>
        <p className="hint">{cadence[selected.frequency ?? 'daily']} · {selected.bucket === 'special' ? '1500 专项' : '3500 基础'} · {categories.find((c) => c.id === selected.categoryId)?.name ?? '其他'}</p>
        {selected.currency && selected.currency !== 'RMB' && <p className="hint">原币 {formatMoney(selected.amount ?? selected.amountRmb, selected.currency)}</p>}
        <p className="hint">下次记录：{nextScheduledChargeDate(selected, todayStr) ?? '暂无'} · 从 {selected.startDate} 开始</p>
      </div>
      <div className="chip-row section-gap">
        <button type="button" className="btn btn-primary" onClick={() => openEdit(selected)}>编辑</button>
        <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>删除</button>
      </div>
      {confirmDelete && <div className="section-gap" role="group" aria-label="确认删除定时支出">
        <p className="hint">删除后今天起不再自动记录「{selected.name}」，以前的流水保留。</p>
        <div className="chip-row"><button type="button" className="btn btn-danger btn-sm" onClick={deleteSelected}>确认删除</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>取消</button></div>
      </div>}
    </>}
    {view === 'form' && <>
      <button type="button" className="chip" onClick={() => { setError(''); setView(editingId ? 'detail' : 'list'); }}>← 返回</button>
      <p className="sheet-section-label section-gap">{editingId ? '编辑定时支出' : '增加定时支出'}</p>
      <div className="field"><label htmlFor="fixed-name">名称</label><input id="fixed-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：话费" maxLength={40} /></div>
      <div className="row-2">
        <div className="field"><label htmlFor="fixed-amount">每次金额</label><input id="fixed-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例如 48" /></div>
        <div className="field"><label htmlFor="fixed-currency">支出币种</label><select id="fixed-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
          {orderedCurrenciesForPicker(settings.preferredCurrencies).map((code) => <option key={code} value={code}>{CURRENCY_META[code].label}</option>)}
        </select></div>
      </div>
      {currency !== 'RMB' && Number(amount) > 0 && <p className="hint">{fx.ready ? `${formatMoney(Number(amount), currency)} ≈ ${formatRmb(toRmbWithRate(Number(amount), fx.rateFor(currency)))} · ${fx.rateNoteFor(currency)}` : '正在获取汇率…'}</p>}
      <div className="field"><label htmlFor="fixed-frequency">记录频率</label><select id="fixed-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
        <option value="daily">每天</option><option value="weekly">每周（与首次记录同一星期）</option><option value="monthly">每月（与首次记录同一日期）</option>
      </select></div>
      <div className="field"><label htmlFor="fixed-category">支出种类 · 决定计入哪个预算</label><select id="fixed-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <optgroup label="基础生活 · 3500">{choices.filter((c) => c.bucket === 'basic').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</optgroup>
        <optgroup label="专项支出 · 1500">{choices.filter((c) => c.bucket === 'special').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</optgroup>
      </select></div>
      <p className="hint">这笔钱只计入{chosen?.bucket === 'special' ? '专项月预算，不占每天的基础预算' : '基础生活预算'}。</p>
      <div className="field"><label htmlFor="fixed-start">{editingId ? '下次记录日期' : '首次记录日期'}</label><input id="fixed-start" type="date" min={todayStr} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
      {frequency === 'monthly' && <p className="hint">如果某月没有对应日期（如 31 日），会在该月最后一天记录。</p>}
      {editingId && <p className="hint">修改从今天起生效，过去的流水保持原样。</p>}
      {categoryId === 'ac' && <p className="hint">若已为同一段空调费设置分摊，请不要再设定时支出，避免重复。</p>}
      {error && <p className="hint" role="alert" style={{ color: 'var(--red-500)' }}>{error}</p>}
      <button type="button" className="btn btn-primary btn-block section-gap" onClick={save} disabled={!fx.ready}>{!fx.ready ? '正在获取汇率…' : editingId ? '保存修改' : '保存并开启'}</button>
    </>}
  </GlassCard>;
}

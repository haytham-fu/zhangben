import { useState } from 'react';
import type { Store } from '../hooks/useStore';
import { useExpenseRates } from '../hooks/useExpenseRates';
import type { Currency } from '../types';
import { CURRENCY_META, formatMoney, formatRmb, orderedCurrenciesForPicker, toRmbWithRate } from '../utils/currency';
import { localDateStr } from '../utils/dates';
import { GlassCard } from './GlassCard';

interface Props {
  store: Store;
  onBack: () => void;
}

export function DailyFixedExpenseManager({ store, onBack }: Props) {
  const { categories, settings, todayStr, addDailyFixedExpense,
    updateDailyFixedExpense, stopDailyFixedExpense } = store;
  const choices = categories.filter((c) =>
    !c.id.startsWith('income_') && c.id !== 'octopus_topup' &&
    c.id !== 'groceries' && c.id !== 'membership');
  const rules = (settings.dailyFixedExpenses ?? []).filter((r) => !r.stoppedOn);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('RMB');
  const fx = useExpenseRates([currency], settings);
  const [categoryId, setCategoryId] = useState(choices.find((c) => c.id === 'ac')?.id ?? choices[0]?.id ?? 'ac');
  const [startDate, setStartDate] = useState(todayStr);
  const [feedback, setFeedback] = useState('');
  const chosen = choices.find((c) => c.id === categoryId);

  function clearForm() {
    setEditingId(null);
    setName('');
    setAmount('');
    setCurrency('RMB');
    setStartDate(localDateStr());
  }

  function save() {
    const n = Number(amount);
    const today = localDateStr();
    if (!fx.ready) return;
    if (!chosen || !Number.isFinite(n) || n < 0.01 || n > 1_000_000) {
      alert('请填写有效的每日金额');
      return;
    }
    if (!editingId && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate < today)) {
      alert('请选择今天或之后的开始日期');
      return;
    }
    const input = {
      name: name.trim() || chosen.name,
      amount: n,
      currency,
      rate: fx.rateFor(currency),
      categoryId: chosen.id,
      bucket: chosen.bucket,
    };
    if (editingId) {
      updateDailyFixedExpense(editingId, input);
      setFeedback('已修改；今天和之后按新金额计算，过去的记录不变');
    } else {
      addDailyFixedExpense(input, startDate);
      setFeedback(startDate === today ? '已设置，今天起自动计入' : `已设置，从 ${startDate} 开始自动计入`);
    }
    clearForm();
  }

  return (
    <>
      <GlassCard title="每日固定支出">
        <p className="hint" style={{ marginTop: 0 }}>
          每天自动记一笔，计入当日总支出和所选预算。关闭网站期间的日期会在下次打开时补齐；这不是银行卡自动扣款。
        </p>
        {feedback && <p className="save-success" role="status">✓ {feedback}</p>}
        {rules.length > 0 && (
          <div className="section-gap">
            <p className="sheet-section-label">已设置的每日支出</p>
            {rules.map((rule) => (
              <div className="grocery-summary-pill section-gap" key={rule.id}>
                <strong>{rule.name} · 每天 {rule.currency && rule.currency !== 'RMB' ? `${formatMoney(rule.amount ?? rule.amountRmb, rule.currency)} ≈ ` : ''}{formatRmb(rule.amountRmb)}</strong>
                <p className="hint" style={{ margin: '4px 0 8px' }}>
                  {categories.find((c) => c.id === rule.categoryId)?.name ?? '其他'} ·
                  {rule.bucket === 'special' ? ' 专项' : ' 基础'} · {rule.startDate} 起
                  {rule.startDate > todayStr ? '（即将开始）' : ''}
                </p>
                <div className="chip-row">
                  <button type="button" className="chip" onClick={() => {
                    setEditingId(rule.id);
                    setName(rule.name);
                    setAmount(String(rule.amount ?? rule.amountRmb));
                    setCurrency(rule.currency ?? 'RMB');
                    setCategoryId(rule.categoryId);
                    setFeedback('');
                  }}>修改</button>
                  <button type="button" className="chip" onClick={() => {
                    if (!confirm(`删除「${rule.name}」的每日固定支出？今天起不再自动计入，过去的记录会保留。`)) return;
                    stopDailyFixedExpense(rule.id);
                    if (editingId === rule.id) clearForm();
                    setFeedback(`已停止「${rule.name}」，今天起不再自动计入`);
                  }}>删除设置</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="section-gap">
          <p className="sheet-section-label">{editingId ? '修改固定支出' : '添加固定支出'}</p>
          <div className="field">
            <label htmlFor="fixed-name">名称（可选）</label>
            <input id="fixed-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={chosen?.name ?? '例如：空调日费'} maxLength={40} />
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor="fixed-amount">每天金额</label>
              <input id="fixed-amount" type="number" inputMode="decimal" min="0.01" step="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例如 10" />
            </div>
            <div className="field">
              <label htmlFor="fixed-currency">支出币种</label>
              <select id="fixed-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {orderedCurrenciesForPicker(settings.preferredCurrencies).map((code) => <option key={code} value={code}>{CURRENCY_META[code].label}</option>)}
              </select>
            </div>
          </div>
          {currency !== 'RMB' && Number(amount) > 0 && (
            <p className="hint">{fx.ready ? `${formatMoney(Number(amount), currency)} ≈ ${formatRmb(toRmbWithRate(Number(amount), fx.rateFor(currency)))} · ${fx.rateNoteFor(currency)}` : '正在获取汇率…'}</p>
          )}
          <div className="field">
            <label htmlFor="fixed-category">支出分类</label>
            <select id="fixed-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {choices.map((cat) => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
            </select>
          </div>
          {editingId ? (
            <p className="hint">修改今天和之后的自动记录，过去已记入的日期不变。</p>
          ) : (
            <div className="field">
              <label htmlFor="fixed-start">开始日期</label>
              <input id="fixed-start" type="date" min={todayStr} value={startDate}
                onChange={(e) => setStartDate(e.target.value)} />
            </div>
          )}
          {categoryId === 'ac' && (
            <p className="hint">如果已经记录了同一段空调费用的分摊，请勿再设置对应日期的固定支出，以免重复计算。</p>
          )}
          <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={!fx.ready}>
            {!fx.ready ? '正在获取汇率…' : editingId ? '保存修改' : '开启每日固定支出'}
          </button>
          {editingId && <button type="button" className="btn btn-secondary btn-block section-gap"
            onClick={clearForm}>取消修改</button>}
        </div>
        <button type="button" className="btn btn-secondary btn-block section-gap" onClick={onBack}>返回支出</button>
      </GlassCard>
    </>
  );
}

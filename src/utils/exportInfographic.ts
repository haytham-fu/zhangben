import type { AppState, Category, Settings, Transaction } from '../types';
import {
  budgetStatus,
  filterMonth,
  monthBasicUsed,
  monthSpecialUsed,
  type BudgetStatus,
} from './budget';

function statusColor(s: BudgetStatus): string {
  switch (s) {
    case 'safe':
      return '#22c55e';
    case 'near':
      return '#f97316';
    case 'over':
      return '#ef6c3a';
    case 'severe':
      return '#dc2626';
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  used: number,
  budget: number,
  planOn: boolean,
) {
  const status = budgetStatus(used, budget);
  const pct = budget > 0 ? Math.min(1, Math.max(0, used / budget)) : used > 0 ? 1 : 0;
  ctx.fillStyle = '#1e40af';
  ctx.font = '600 22px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#64748b';
  ctx.font = '500 18px "PingFang SC", "Noto Sans SC", sans-serif';
  const nums = planOn
    ? `¥${used.toFixed(0)} / ¥${budget.toFixed(0)}`
    : `¥${used.toFixed(0)}`;
  ctx.fillText(nums, x + w - ctx.measureText(nums).width, y);
  roundRect(ctx, x, y + 10, w, 16, 8);
  ctx.fillStyle = 'rgba(191, 219, 254, 0.7)';
  ctx.fill();
  if (pct > 0) {
    roundRect(ctx, x, y + 10, Math.max(8, w * pct), 16, 8);
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    if (planOn) {
      const c = statusColor(status);
      grd.addColorStop(0, '#60a5fa');
      grd.addColorStop(1, c);
    } else {
      grd.addColorStop(0, '#60a5fa');
      grd.addColorStop(1, '#3b82f6');
    }
    ctx.fillStyle = grd;
    ctx.fill();
  }
  if (planOn) {
    ctx.fillStyle = statusColor(status);
    ctx.font = '700 14px "PingFang SC", "Noto Sans SC", sans-serif';
    const tag =
      status === 'safe' ? '安全' : status === 'near' ? '临近' : status === 'over' ? '超支' : '严重';
    ctx.fillText(tag, x, y + 48);
  }
}

function monthIncome(txs: Transaction[]): number {
  return Math.round(
    txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amountRmb, 0) * 100,
  ) / 100;
}

function monthExpense(txs: Transaction[]): number {
  return (
    Math.round(
      txs
        .filter((t) => t.type === 'expense' && t.kind !== 'topup')
        .reduce((a, t) => a + t.amountRmb, 0) * 100,
    ) / 100
  );
}

export interface InfographicOptions {
  ym: string; // yyyy-MM
  state: AppState;
}

/** Render month summary to a JPEG Blob (client-side canvas). */
export async function renderLedgerInfographic(opts: InfographicOptions): Promise<Blob> {
  const { ym, state } = opts;
  const settings: Settings = state.settings;
  const planOn = settings.dailyPlanCompareEnabled !== false;
  const monthTxs = filterMonth(state.transactions, ym);
  const includeOpts = { includeSpecial: settings.includeSpecialInAdvice };
  const basicUsed = monthBasicUsed(state.transactions, state.settings, ym, includeOpts);
  const specialUsed = monthSpecialUsed(state.transactions, state.settings, ym, includeOpts);
  const totalUsed = basicUsed + specialUsed;
  const income = monthIncome(monthTxs);
  const expense = monthExpense(monthTxs);

  const catMap = new Map(state.categories.map((c: Category) => [c.id, c]));
  const catSums = new Map<string, number>();
  for (const t of monthTxs) {
    if (t.type !== 'expense' || t.kind === 'topup') continue;
    if (!includeOpts.includeSpecial && t.isSpecial) continue;
    catSums.set(t.categoryId, (catSums.get(t.categoryId) ?? 0) + t.amountRmb);
  }
  const topCats = [...catSums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCat = topCats[0]?.[1] ?? 1;

  const W = 1080;
  const H = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  // Background gradient (blue glass vibe)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#dbeafe');
  bg.addColorStop(0.4, '#bfdbfe');
  bg.addColorStop(0.75, '#e0e7ff');
  bg.addColorStop(1, '#eff6ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft blobs (cartoon accents)
  ctx.fillStyle = 'rgba(96, 165, 250, 0.35)';
  ctx.beginPath();
  ctx.arc(140, 120, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(167, 139, 250, 0.28)';
  ctx.beginPath();
  ctx.arc(960, 200, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
  ctx.beginPath();
  ctx.arc(900, 1280, 120, 0, Math.PI * 2);
  ctx.fill();

  // Title card
  roundRect(ctx, 60, 70, W - 120, 160, 36);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1d4ed8';
  ctx.font = '800 56px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText('账本', 100, 145);
  // cute coin
  ctx.beginPath();
  ctx.arc(980, 140, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 28px sans-serif';
  ctx.fillText('¥', 968, 150);

  const [y, m] = ym.split('-');
  ctx.fillStyle = '#64748b';
  ctx.font = '600 28px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(`${y}年${Number(m)}月 · 一图速览`, 100, 195);

  // Totals card
  roundRect(ctx, 60, 260, W - 120, 160, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();

  const drawStat = (x: number, label: string, value: string, color: string) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 20px "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillText(label, x, 310);
    ctx.fillStyle = color;
    ctx.font = '800 40px "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillText(value, x, 365);
  };
  drawStat(100, '本月支出', `¥${expense.toFixed(0)}`, '#ef4444');
  drawStat(420, '本月收入', `¥${income.toFixed(0)}`, '#16a34a');
  drawStat(740, '净支出合计', `¥${totalUsed.toFixed(0)}`, '#1e40af');

  // Budget / summary card
  roundRect(ctx, 60, 450, W - 120, planOn ? 280 : 200, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();

  ctx.fillStyle = '#1e40af';
  ctx.font = '700 28px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(planOn ? '预算进度' : '分类桶汇总', 100, 500);

  drawProgress(
    ctx,
    100,
    545,
    W - 200,
    planOn ? `基础生活 ${settings.basicBudget}` : '基础生活',
    basicUsed,
    settings.basicBudget,
    planOn,
  );
  drawProgress(
    ctx,
    100,
    620,
    W - 200,
    planOn ? `专项 ${settings.specialBudget}` : '专项',
    specialUsed,
    settings.specialBudget,
    planOn,
  );
  if (planOn) {
    drawProgress(
      ctx,
      100,
      695,
      W - 200,
      `合计 ${settings.basicBudget + settings.specialBudget}`,
      totalUsed,
      settings.basicBudget + settings.specialBudget,
      true,
    );
  }

  // Category breakdown
  const catTop = planOn ? 760 : 680;
  roundRect(ctx, 60, catTop, W - 120, 520, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();

  ctx.fillStyle = '#1e40af';
  ctx.font = '700 28px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText('分类支出 TOP', 100, catTop + 50);

  if (topCats.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 24px "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillText('本月暂无支出记录', 100, catTop + 120);
  } else {
    let yy = catTop + 90;
    for (const [id, amt] of topCats) {
      const c = catMap.get(id);
      const name = c ? `${c.icon} ${c.name}` : id;
      const barW = ((W - 280) * amt) / maxCat;
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 22px "PingFang SC", "Noto Sans SC", sans-serif';
      ctx.fillText(name, 100, yy);
      roundRect(ctx, 100, yy + 12, W - 280, 18, 9);
      ctx.fillStyle = 'rgba(191, 219, 254, 0.65)';
      ctx.fill();
      roundRect(ctx, 100, yy + 12, Math.max(10, barW), 18, 9);
      const g = ctx.createLinearGradient(100, 0, 100 + (W - 280), 0);
      g.addColorStop(0, '#93c5fd');
      g.addColorStop(1, '#3b82f6');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = '#1e40af';
      ctx.font = '700 20px "PingFang SC", "Noto Sans SC", sans-serif';
      const av = `¥${amt.toFixed(0)}`;
      ctx.fillText(av, W - 100 - ctx.measureText(av).width, yy);
      yy += 52;
    }
  }

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '500 20px "PingFang SC", "Noto Sans SC", sans-serif';
  const foot = planOn
    ? '计划对照已开启 · 本地账本 PWA'
    : '简单记账模式 · 本地账本 PWA';
  ctx.fillText(foot, 60, H - 40);
  ctx.fillText('💙', W - 100, H - 40);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('JPG 导出失败'));
      },
      'image/jpeg',
      0.92,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

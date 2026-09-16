import type { BudgetStatus } from '../utils/budget';
import { formatRmb } from '../utils/currency';

const STATUS_LABEL: Record<BudgetStatus, string> = {
  safe: '安全',
  near: '临近',
  over: '超支',
  severe: '严重超支',
};

interface Props {
  label: string;
  used: number;
  budget: number;
  status: BudgetStatus;
  remainLabel?: boolean;
  extra?: string;
}

export function ProgressBar({ label, used, budget, status, remainLabel = true, extra }: Props) {
  const pct = budget > 0 ? Math.min(100, Math.max(0, (used / budget) * 100)) : used > 0 ? 100 : 0;
  const remain = budget - used;
  return (
    <div className="progress-wrap">
      <div className="progress-meta">
        <span className="label">
          {label}{' '}
          <span className={`status-tag ${status}`}>{STATUS_LABEL[status]}</span>
        </span>
        <span className="nums">
          {formatRmb(used)} / {formatRmb(budget)}
        </span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progress-fill status-${status}`} style={{ width: `${pct}%` }} />
      </div>
      {(remainLabel || extra) && (
        <p className="hint">
          {remainLabel && (remain >= 0 ? `剩余 ${formatRmb(remain)}` : `超支 ${formatRmb(-remain)}`)}
          {extra ? ` · ${extra}` : ''}
        </p>
      )}
    </div>
  );
}

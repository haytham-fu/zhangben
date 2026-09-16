import type { PaymentMethod } from '../types';
import { PAYMENT_OPTIONS } from '../utils/payment';
import { IconPayment } from './CuteIcons';

interface Props {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  /** Hide none; always show real methods */
  compact?: boolean;
}

export function PaymentPicker({ value, onChange, compact }: Props) {
  return (
    <div className="chip-row">
      {PAYMENT_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip chip-with-icon ${value === o.id ? 'active' : ''} ${compact ? 'chip-sm' : ''}`}
          onClick={() => onChange(o.id)}
        >
          <IconPayment method={o.id} size={compact ? 16 : 18} />
          {o.label}
        </button>
      ))}
    </div>
  );
}

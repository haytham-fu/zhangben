import { useEffect, useState, type FocusEvent, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** Committed numeric value from parent state */
  value: number;
  /** Called when a valid number is typed, or on blur (empty → 0) */
  onValueChange: (n: number) => void;
  /** Reject commits below this (default 0). Empty blur still saves 0. */
  min?: number;
};

/**
 * Controlled amount field that keeps a local draft string so clearing "0"
 * with backspace works. Commits on valid input; empty blurs to 0.
 * Focus selects all for easy mobile replace.
 */
export function AmountInput({
  value,
  onValueChange,
  min = 0,
  onFocus,
  onBlur,
  step,
  inputMode = 'decimal',
  ...rest
}: Props) {
  const [draft, setDraft] = useState(() => formatDraft(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatDraft(value));
  }, [value, focused]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
      onValueChange(0);
      setDraft('0');
      return;
    }
    const n = parseFloat(trimmed);
    if (Number.isNaN(n) || n < min) {
      setDraft(formatDraft(value));
      return;
    }
    onValueChange(n);
    setDraft(formatDraft(n));
  }

  return (
    <input
      type="number"
      inputMode={inputMode}
      step={step}
      {...rest}
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (v.trim() === '') return;
        const n = parseFloat(v);
        if (!Number.isNaN(n) && n >= min) onValueChange(n);
      }}
      onFocus={(e: FocusEvent<HTMLInputElement>) => {
        setFocused(true);
        e.target.select();
        onFocus?.(e);
      }}
      onBlur={(e: FocusEvent<HTMLInputElement>) => {
        setFocused(false);
        commit(draft);
        onBlur?.(e);
      }}
    />
  );
}

function formatDraft(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(n);
}

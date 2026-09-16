import { useMemo } from 'react';
import { formatRmb } from '../utils/currency';

interface Props {
  /** Remaining RMB (can be negative when overspent) */
  remaining: number;
  /** Total monthly budget RMB */
  budget: number;
}

/**
 * Cute 小金山 — soft gold pile that grows/shrinks with remaining budget.
 * Soft amber tones that sit with the blue glass theme (no neon).
 */
export function GoldMountain({ remaining, budget }: Props) {
  const ratio = useMemo(() => {
    if (budget <= 0) return remaining > 0 ? 1 : 0;
    return Math.max(0, Math.min(1, remaining / budget));
  }, [remaining, budget]);

  // Visual tiers for shine / erosion feel
  const level = ratio >= 0.75 ? 'full' : ratio >= 0.4 ? 'mid' : ratio >= 0.12 ? 'low' : 'empty';
  const over = remaining < 0;

  // Peak heights (viewBox 120x90); scale with ratio, keep a tiny base when empty
  const h1 = 18 + ratio * 48; // left
  const h2 = 22 + ratio * 58; // center (tallest)
  const h3 = 16 + ratio * 42; // right
  const baseY = 78;
  const shine = 0.25 + ratio * 0.55;
  const sparkle = ratio > 0.55;

  return (
    <div
      className={`gold-mountain gold-mountain--${level}${over ? ' gold-mountain--over' : ''}`}
      role="img"
      aria-label={`小金山：本月剩余 ${formatRmb(remaining)}`}
    >
      <svg viewBox="0 0 120 90" className="gold-mountain-svg" aria-hidden>
        <defs>
          <linearGradient id="gm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gm-gold-l" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5E6C8" />
            <stop offset="55%" stopColor="#E4C98A" />
            <stop offset="100%" stopColor="#C9A86C" />
          </linearGradient>
          <linearGradient id="gm-gold-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8EDD4" />
            <stop offset="40%" stopColor="#E8D4A8" />
            <stop offset="100%" stopColor="#B8955A" />
          </linearGradient>
          <linearGradient id="gm-gold-r" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0E0BE" />
            <stop offset="60%" stopColor="#D4B896" />
            <stop offset="100%" stopColor="#B8955A" />
          </linearGradient>
          <linearGradient id="gm-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BFDBFE" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="120" height="90" fill="url(#gm-sky)" rx="16" />
        <ellipse cx="60" cy="82" rx="48" ry="8" fill="url(#gm-ground)" />

        {/* Left peak */}
        <path
          className="gm-peak gm-peak-l"
          d={`M18 ${baseY} L34 ${baseY - h1} L50 ${baseY} Z`}
          fill="url(#gm-gold-l)"
          style={{ opacity: 0.55 + ratio * 0.4 }}
        />
        {/* Right peak */}
        <path
          className="gm-peak gm-peak-r"
          d={`M70 ${baseY} L86 ${baseY - h3} L102 ${baseY} Z`}
          fill="url(#gm-gold-r)"
          style={{ opacity: 0.5 + ratio * 0.4 }}
        />
        {/* Center peak */}
        <path
          className="gm-peak gm-peak-c"
          d={`M40 ${baseY} L60 ${baseY - h2} L80 ${baseY} Z`}
          fill="url(#gm-gold-c)"
          style={{ opacity: 0.65 + ratio * 0.35 }}
        />

        {/* Soft crest highlight */}
        <ellipse
          className="gm-shine"
          cx="60"
          cy={baseY - h2 + 6}
          rx={6 + ratio * 4}
          ry={3 + ratio * 2}
          fill="#FFFBF0"
          style={{ opacity: shine * 0.7 }}
        />

        {/* Coin dots when fuller */}
        {sparkle && (
          <g className="gm-sparkles" style={{ opacity: (ratio - 0.55) / 0.45 }}>
            <circle cx="52" cy={baseY - h2 + 14} r="2.2" fill="#FFF8E7" />
            <circle cx="68" cy={baseY - h2 + 18} r="1.8" fill="#F5E6C8" />
            <circle cx="44" cy={baseY - h1 + 10} r="1.6" fill="#FFFBF0" />
          </g>
        )}

        {/* Tiny flag / peak star when near full */}
        {ratio >= 0.85 && (
          <g className="gm-flag" style={{ opacity: (ratio - 0.85) / 0.15 }}>
            <line
              x1="60"
              y1={baseY - h2}
              x2="60"
              y2={baseY - h2 - 10}
              stroke="#93C5FD"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d={`M60 ${baseY - h2 - 10} L70 ${baseY - h2 - 7} L60 ${baseY - h2 - 4} Z`}
              fill="#60A5FA"
              opacity="0.85"
            />
          </g>
        )}
      </svg>
      <div className="gold-mountain-caption">
        <span className="gm-title">小金山</span>
        <span className="gm-remain">
          {over ? `已掏空 · 超 ${formatRmb(-remaining)}` : `还剩 ${formatRmb(remaining)}`}
        </span>
      </div>
    </div>
  );
}

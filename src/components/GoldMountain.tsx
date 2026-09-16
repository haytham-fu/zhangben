import { useMemo } from 'react';
import { formatRmb } from '../utils/currency';

interface Props {
  /** Remaining RMB (can be negative when overspent) */
  remaining: number;
  /** Total monthly budget RMB */
  budget: number;
}

/**
 * Cute cartoon 小金山 — soft rounded gold piles, friendly face, sparkles.
 * Grows/shrinks with remaining budget; soft gold that fits liquid glass.
 */
export function GoldMountain({ remaining, budget }: Props) {
  const ratio = useMemo(() => {
    if (budget <= 0) return remaining > 0 ? 1 : 0;
    return Math.max(0, Math.min(1, remaining / budget));
  }, [remaining, budget]);

  const level = ratio >= 0.75 ? 'full' : ratio >= 0.4 ? 'mid' : ratio >= 0.12 ? 'low' : 'empty';
  const over = remaining < 0;

  // Soft mound heights (viewBox 120×96)
  const baseY = 80;
  const hL = 14 + ratio * 36;
  const hC = 20 + ratio * 48;
  const hR = 12 + ratio * 32;
  const faceY = baseY - hC * 0.42;
  const showFace = ratio >= 0.08 && !over;
  const sparkle = ratio > 0.35;
  const bigSparkle = ratio >= 0.7;

  return (
    <div
      className={`gold-mountain gold-mountain--${level}${over ? ' gold-mountain--over' : ''}`}
      role="img"
      aria-label={`小金山：本月剩余 ${formatRmb(remaining)}`}
    >
      <svg viewBox="0 0 120 96" className="gold-mountain-svg" aria-hidden>
        <defs>
          <linearGradient id="gm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gm-gold-l" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#FFF6E0" />
            <stop offset="45%" stopColor="#F0D9A0" />
            <stop offset="100%" stopColor="#D4B07A" />
          </linearGradient>
          <linearGradient id="gm-gold-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFBF0" />
            <stop offset="35%" stopColor="#F5E0B0" />
            <stop offset="100%" stopColor="#C9A86C" />
          </linearGradient>
          <linearGradient id="gm-gold-r" x1="0.2" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8EDD0" />
            <stop offset="55%" stopColor="#E4C98A" />
            <stop offset="100%" stopColor="#B8955A" />
          </linearGradient>
          <linearGradient id="gm-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BFDBFE" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.12" />
          </linearGradient>
          <filter id="gm-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="b" />
            <feOffset dy="1" result="o" />
            <feColorMatrix
              in="o"
              type="matrix"
              values="0 0 0 0 0.72  0 0 0 0 0.58  0 0 0 0 0.35  0 0 0 0.18 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="120" height="96" fill="url(#gm-sky)" rx="18" />
        <ellipse cx="60" cy="86" rx="50" ry="9" fill="url(#gm-ground)" />

        {/* Soft rounded piles (blob mounds) */}
        <g filter="url(#gm-soft)" style={{ opacity: 0.55 + ratio * 0.4 }}>
          <path
            className="gm-peak gm-peak-l"
            d={`
              M14 ${baseY}
              C18 ${baseY - hL * 0.55}, 22 ${baseY - hL}, 32 ${baseY - hL}
              C42 ${baseY - hL}, 48 ${baseY - hL * 0.5}, 52 ${baseY}
              Z
            `}
            fill="url(#gm-gold-l)"
          />
          <path
            className="gm-peak gm-peak-r"
            d={`
              M68 ${baseY}
              C72 ${baseY - hR * 0.5}, 78 ${baseY - hR}, 88 ${baseY - hR}
              C98 ${baseY - hR}, 104 ${baseY - hR * 0.55}, 108 ${baseY}
              Z
            `}
            fill="url(#gm-gold-r)"
          />
          <path
            className="gm-peak gm-peak-c"
            d={`
              M30 ${baseY}
              C34 ${baseY - hC * 0.6}, 42 ${baseY - hC}, 60 ${baseY - hC}
              C78 ${baseY - hC}, 86 ${baseY - hC * 0.6}, 90 ${baseY}
              Z
            `}
            fill="url(#gm-gold-c)"
          />
        </g>

        {/* Cream highlight on crown */}
        <ellipse
          className="gm-shine"
          cx="56"
          cy={baseY - hC + 8}
          rx={8 + ratio * 5}
          ry={4 + ratio * 2.5}
          fill="#FFFBF0"
          style={{ opacity: 0.2 + ratio * 0.45 }}
        />

        {/* Friendly face on center pile */}
        {showFace && (
          <g className="gm-face" style={{ opacity: Math.min(1, 0.4 + ratio * 0.7) }}>
            <ellipse cx="52" cy={faceY} rx="2.4" ry="2.8" fill="#8B6914" opacity="0.75" />
            <ellipse cx="68" cy={faceY} rx="2.4" ry="2.8" fill="#8B6914" opacity="0.75" />
            <circle cx="52.6" cy={faceY - 0.6} r="0.7" fill="#FFFBF0" opacity="0.9" />
            <circle cx="68.6" cy={faceY - 0.6} r="0.7" fill="#FFFBF0" opacity="0.9" />
            {/* blush */}
            <ellipse cx="46" cy={faceY + 4} rx="3.2" ry="1.8" fill="#E8B86D" opacity="0.35" />
            <ellipse cx="74" cy={faceY + 4} rx="3.2" ry="1.8" fill="#E8B86D" opacity="0.35" />
            {/* smile — happier when fuller */}
            <path
              d={
                ratio >= 0.5
                  ? `M54 ${faceY + 7} Q60 ${faceY + 11} 66 ${faceY + 7}`
                  : `M55 ${faceY + 7.5} Q60 ${faceY + 9.5} 65 ${faceY + 7.5}`
              }
              fill="none"
              stroke="#8B6914"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.7"
            />
          </g>
        )}

        {/* Overspent: tiny worried brows */}
        {over && (
          <g className="gm-face" opacity="0.7">
            <ellipse cx="52" cy={baseY - 10} rx="2.2" ry="2.5" fill="#8B6914" />
            <ellipse cx="68" cy={baseY - 10} rx="2.2" ry="2.5" fill="#8B6914" />
            <path
              d={`M54 ${baseY - 3} Q60 ${baseY - 5} 66 ${baseY - 3}`}
              fill="none"
              stroke="#8B6914"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Sparkles */}
        {sparkle && (
          <g className="gm-sparkles" style={{ opacity: Math.min(1, (ratio - 0.35) / 0.4) }}>
            <path
              d="M28 28 l1.2 3.2 3.2 1.2 -3.2 1.2 -1.2 3.2 -1.2 -3.2 -3.2 -1.2 3.2 -1.2 Z"
              fill="#FFF8E7"
            />
            <path
              d="M92 34 l0.9 2.4 2.4 0.9 -2.4 0.9 -0.9 2.4 -0.9 -2.4 -2.4 -0.9 2.4 -0.9 Z"
              fill="#F5E6C8"
            />
            <circle cx="78" cy={baseY - hC + 16} r="1.6" fill="#FFFBF0" />
          </g>
        )}
        {bigSparkle && (
          <g className="gm-sparkles" style={{ opacity: (ratio - 0.7) / 0.3 }}>
            <path
              d="M60 12 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z"
              fill="#FFFBF0"
            />
            <circle cx="40" cy="22" r="1.4" fill="#F8EDD4" />
            <circle cx="86" cy="20" r="1.2" fill="#FFF8E7" />
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRmb } from '../utils/currency';

interface Props {
  /** Remaining RMB (can be negative when overspent) */
  remaining: number;
  /** Total monthly budget RMB */
  budget: number;
}

type Nugget = {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  fill: string;
  /** Min ratio to show this piece (stack grows with budget left) */
  min: number;
};

/**
 * Cartoon-cute 小金山 — soft gold nuggets / ingots heaped in piles.
 * Heap height morphs with remaining budget; bounce when the amount changes.
 */
export function GoldMountain({ remaining, budget }: Props) {
  const ratio = useMemo(() => {
    if (budget <= 0) return remaining > 0 ? 1 : 0;
    return Math.max(0, Math.min(1, remaining / budget));
  }, [remaining, budget]);

  const level = ratio >= 0.75 ? 'full' : ratio >= 0.4 ? 'mid' : ratio >= 0.12 ? 'low' : 'empty';
  const over = remaining < 0;

  const prevRemain = useRef(remaining);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (prevRemain.current === remaining) return;
    prevRemain.current = remaining;
    setBump(false);
    const id = requestAnimationFrame(() => setBump(true));
    return () => cancelAnimationFrame(id);
  }, [remaining]);

  // Soft natural gold fills (not neon)
  const fills = {
    light: 'url(#gm-ingot-light)',
    mid: 'url(#gm-ingot-mid)',
    deep: 'url(#gm-ingot-deep)',
    warm: 'url(#gm-ingot-warm)',
  };

  // Stacked piles: bottom wide → top tip. y grows downward in SVG.
  const nuggets: Nugget[] = [
    // Base row (left pile)
    { x: 10, y: 68, w: 28, h: 16, rx: 6, fill: fills.deep, min: 0 },
    { x: 34, y: 70, w: 30, h: 15, rx: 6, fill: fills.mid, min: 0 },
    { x: 60, y: 69, w: 28, h: 16, rx: 6, fill: fills.warm, min: 0 },
    { x: 84, y: 71, w: 26, h: 14, rx: 6, fill: fills.deep, min: 0.05 },
    // Second tier
    { x: 18, y: 54, w: 26, h: 15, rx: 6, fill: fills.mid, min: 0.12 },
    { x: 42, y: 52, w: 30, h: 16, rx: 7, fill: fills.light, min: 0.08 },
    { x: 70, y: 55, w: 28, h: 15, rx: 6, fill: fills.warm, min: 0.15 },
    // Third tier
    { x: 28, y: 39, w: 27, h: 14, rx: 6, fill: fills.warm, min: 0.28 },
    { x: 52, y: 37, w: 30, h: 15, rx: 7, fill: fills.light, min: 0.22 },
    { x: 78, y: 42, w: 22, h: 13, rx: 6, fill: fills.mid, min: 0.35 },
    // Peak nuggets
    { x: 40, y: 24, w: 26, h: 14, rx: 7, fill: fills.light, min: 0.45 },
    { x: 58, y: 22, w: 24, h: 13, rx: 6, fill: fills.warm, min: 0.55 },
    // Tiny crown nugget
    { x: 50, y: 12, w: 20, h: 12, rx: 6, fill: fills.light, min: 0.7 },
  ];

  const visible = nuggets.filter((n) => ratio >= n.min || (over && n.min <= 0.12));
  const showFace = ratio >= 0.18 && !over;
  const sparkle = ratio > 0.35;
  const bigSparkle = ratio >= 0.7;

  // Scale whole heap slightly with ratio (morph), floor so empty isn't invisible
  const heapScale = 0.72 + ratio * 0.28;
  const heapY = (1 - heapScale) * 40;

  const faceNugget = visible.find((n) => n.min >= 0.22) ?? visible[visible.length - 1];
  const faceCx = faceNugget ? faceNugget.x + faceNugget.w / 2 : 60;
  const faceCy = faceNugget ? faceNugget.y + faceNugget.h * 0.45 : 48;

  return (
    <div
      className={`gold-mountain gold-mountain--${level}${over ? ' gold-mountain--over' : ''}${bump ? ' gold-mountain--bump' : ''}`}
      role="img"
      aria-label={`小金山：本月剩余 ${formatRmb(remaining)}`}
      onAnimationEnd={(e) => {
        if (e.animationName === 'gm-stack-bounce') setBump(false);
      }}
    >
      <svg viewBox="0 0 120 96" className="gold-mountain-svg" aria-hidden>
        <defs>
          <linearGradient id="gm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gm-ingot-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF8E8" />
            <stop offset="40%" stopColor="#F3DFB0" />
            <stop offset="100%" stopColor="#D9B87A" />
          </linearGradient>
          <linearGradient id="gm-ingot-mid" x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0%" stopColor="#F8EDD0" />
            <stop offset="50%" stopColor="#E4C48A" />
            <stop offset="100%" stopColor="#C9A066" />
          </linearGradient>
          <linearGradient id="gm-ingot-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EED9A8" />
            <stop offset="55%" stopColor="#D0AE72" />
            <stop offset="100%" stopColor="#B89050" />
          </linearGradient>
          <linearGradient id="gm-ingot-warm" x1="0.1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF4DC" />
            <stop offset="45%" stopColor="#E8C98A" />
            <stop offset="100%" stopColor="#C4A06A" />
          </linearGradient>
          <linearGradient id="gm-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BFDBFE" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.1" />
          </linearGradient>
          <filter id="gm-soft" x="-15%" y="-15%" width="130%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.55" result="b" />
            <feOffset dy="1.1" result="o" />
            <feColorMatrix
              in="o"
              type="matrix"
              values="0 0 0 0 0.7  0 0 0 0 0.55  0 0 0 0 0.32  0 0 0 0.16 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="120" height="96" fill="url(#gm-sky)" rx="18" />
        <ellipse cx="60" cy="88" rx="48" ry="8" fill="url(#gm-ground)" />

        <g
          className="gm-heap"
          filter="url(#gm-soft)"
          style={{
            transformOrigin: '60px 84px',
            transform: `translateY(${heapY}px) scale(${heapScale})`,
            opacity: over ? 0.55 : 0.72 + ratio * 0.28,
          }}
        >
          {nuggets.map((n, i) => {
            const on = ratio >= n.min || (over && n.min <= 0.12);
            return (
              <g
                key={i}
                className={`gm-nugget${on ? ' gm-nugget--on' : ''}`}
                style={{
                  opacity: on ? 1 : 0,
                  transform: on ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.85)',
                  transformOrigin: `${n.x + n.w / 2}px ${n.y + n.h}px`,
                  transitionDelay: `${Math.min(i * 28, 280)}ms`,
                }}
              >
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.rx} fill={n.fill} />
                {/* soft top bevel highlight */}
                <rect
                  x={n.x + 3}
                  y={n.y + 2}
                  width={n.w - 6}
                  height={Math.max(3, n.h * 0.28)}
                  rx={n.rx * 0.55}
                  fill="#FFFBF0"
                  opacity="0.28"
                />
              </g>
            );
          })}
        </g>

        {showFace && faceNugget && (
          <g className="gm-face" style={{ opacity: Math.min(1, 0.45 + ratio * 0.55) }}>
            <ellipse cx={faceCx - 5} cy={faceCy} rx="2.1" ry="2.5" fill="#8B6914" opacity="0.72" />
            <ellipse cx={faceCx + 5} cy={faceCy} rx="2.1" ry="2.5" fill="#8B6914" opacity="0.72" />
            <circle cx={faceCx - 4.4} cy={faceCy - 0.5} r="0.55" fill="#FFFBF0" opacity="0.9" />
            <circle cx={faceCx + 5.6} cy={faceCy - 0.5} r="0.55" fill="#FFFBF0" opacity="0.9" />
            <ellipse cx={faceCx - 9} cy={faceCy + 3.5} rx="2.6" ry="1.5" fill="#E8B86D" opacity="0.32" />
            <ellipse cx={faceCx + 9} cy={faceCy + 3.5} rx="2.6" ry="1.5" fill="#E8B86D" opacity="0.32" />
            <path
              d={
                ratio >= 0.5
                  ? `M${faceCx - 5} ${faceCy + 6} Q${faceCx} ${faceCy + 9.5} ${faceCx + 5} ${faceCy + 6}`
                  : `M${faceCx - 4} ${faceCy + 6.5} Q${faceCx} ${faceCy + 8} ${faceCx + 4} ${faceCy + 6.5}`
              }
              fill="none"
              stroke="#8B6914"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.68"
            />
          </g>
        )}

        {over && (
          <g className="gm-face" opacity="0.65">
            <ellipse cx="52" cy="62" rx="2" ry="2.3" fill="#8B6914" />
            <ellipse cx="66" cy="62" rx="2" ry="2.3" fill="#8B6914" />
            <path
              d="M54 68 Q59 66 64 68"
              fill="none"
              stroke="#8B6914"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        )}

        {sparkle && (
          <g className="gm-sparkles" style={{ opacity: Math.min(1, (ratio - 0.35) / 0.4) }}>
            <path
              d="M22 30 l1.1 2.9 2.9 1.1 -2.9 1.1 -1.1 2.9 -1.1 -2.9 -2.9 -1.1 2.9 -1.1 Z"
              fill="#FFF8E7"
            />
            <path
              d="M96 36 l0.85 2.2 2.2 0.85 -2.2 0.85 -0.85 2.2 -0.85 -2.2 -2.2 -0.85 2.2 -0.85 Z"
              fill="#F5E6C8"
            />
            <circle cx="82" cy="28" r="1.4" fill="#FFFBF0" />
          </g>
        )}
        {bigSparkle && (
          <g className="gm-sparkles" style={{ opacity: (ratio - 0.7) / 0.3 }}>
            <path
              d="M60 6 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4 Z"
              fill="#FFFBF0"
            />
            <circle cx="38" cy="16" r="1.3" fill="#F8EDD4" />
            <circle cx="88" cy="14" r="1.1" fill="#FFF8E7" />
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

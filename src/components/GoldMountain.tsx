import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRmb } from '../utils/currency';

interface Props {
  /** Remaining RMB (can be negative when overspent) */
  remaining: number;
  /** Total monthly budget RMB */
  budget: number;
}

type Brick = {
  row: number;
  col: number;
  x: number;
  y: number;
  /** Show when remaining ratio >= this (higher rows need more surplus) */
  min: number;
  shade: 0 | 1 | 2;
};

const COLS = 10;
const ROWS = 7;
const BRICK_W = 28;
const BRICK_H = 11;
const GAP_X = 3;
const GAP_Y = 3;
const PAD_X = 6;
const VIEW_W = PAD_X * 2 + COLS * BRICK_W + (COLS - 1) * GAP_X;
const VIEW_H = 16 + ROWS * BRICK_H + (ROWS - 1) * GAP_Y + 18;

function buildBricks(): Brick[] {
  const bricks: Brick[] = [];
  // Pyramid wall: top tip narrow, base wide; top layers need more remaining budget
  for (let row = 0; row < ROWS; row++) {
    // row 0 = top of SVG; row ROWS-1 = base
    const fromBottom = ROWS - 1 - row;
    const colsInRow = COLS - fromBottom; // tip ~4 … base 10
    const offsetCols = (COLS - colsInRow) / 2;
    // Base always visible; tip only when surplus high
    const rowMin = fromBottom / ROWS;
    for (let c = 0; c < colsInRow; c++) {
      const col = offsetCols + c;
      const x = PAD_X + col * (BRICK_W + GAP_X);
      const y = 12 + row * (BRICK_H + GAP_Y);
      const colT = (c / Math.max(1, colsInRow - 1)) * (0.05 / ROWS);
      bricks.push({
        row,
        col: c,
        x,
        y,
        min: Math.min(0.92, rowMin + colT),
        shade: ((row + c) % 3) as 0 | 1 | 2,
      });
    }
  }
  return bricks;
}

const ALL_BRICKS = buildBricks();

/**
 * 小金山 — soft champagne stacked 金砖 wall.
 * Layers disappear as remaining budget drops; full surplus = tall wide wall.
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

  const fills = ['url(#gm-brick-a)', 'url(#gm-brick-b)', 'url(#gm-brick-c)'] as const;

  const visibleCount = ALL_BRICKS.filter((b) => ratio >= b.min || (over && b.min <= 0.02)).length;

  return (
    <div
      className={`gold-mountain gold-mountain--${level}${over ? ' gold-mountain--over' : ''}${bump ? ' gold-mountain--bump' : ''}`}
      role="img"
      aria-label={`小金山：本月剩余 ${formatRmb(remaining)}，金砖 ${visibleCount} 块`}
      onAnimationEnd={(e) => {
        if (e.animationName === 'gm-stack-bounce') setBump(false);
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="gold-mountain-svg"
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Soft champagne bars — flat, muted, glass-friendly */}
          <linearGradient id="gm-brick-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FBF6EA" />
            <stop offset="100%" stopColor="#E8D5B0" />
          </linearGradient>
          <linearGradient id="gm-brick-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7EEDC" />
            <stop offset="100%" stopColor="#DFC89A" />
          </linearGradient>
          <linearGradient id="gm-brick-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F3E6CF" />
            <stop offset="100%" stopColor="#D4BC8E" />
          </linearGradient>
          <linearGradient id="gm-brick-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <filter id="gm-brick-soft" x="-10%" y="-18%" width="120%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#B8955A" floodOpacity="0.14" />
          </filter>
        </defs>

        <g
          className="gm-heap"
          filter="url(#gm-brick-soft)"
          style={{ opacity: over ? 0.45 : 0.9 + ratio * 0.1 }}
        >
          {ALL_BRICKS.map((b, i) => {
            const on = ratio >= b.min || (over && b.min <= 0.02);
            const rx = 3.5;
            return (
              <g
                key={`${b.row}-${b.col}`}
                className={`gm-brick${on ? ' gm-brick--on' : ''}`}
                style={{
                  opacity: on ? 1 : 0,
                  transform: on ? 'translateY(0) scale(1)' : 'translateY(5px) scale(0.94)',
                  transformOrigin: `${b.x + BRICK_W / 2}px ${b.y + BRICK_H}px`,
                  transitionDelay: on ? `${Math.min(i * 10, 180)}ms` : '0ms',
                }}
              >
                <rect
                  x={b.x}
                  y={b.y}
                  width={BRICK_W}
                  height={BRICK_H}
                  rx={rx}
                  fill={fills[b.shade]}
                  stroke="#C9B07A"
                  strokeOpacity="0.28"
                  strokeWidth="0.7"
                />
                {/* Soft top sheen only */}
                <rect
                  x={b.x + 2}
                  y={b.y + 1.4}
                  width={BRICK_W - 4}
                  height={3.6}
                  rx={1.8}
                  fill="url(#gm-brick-sheen)"
                />
              </g>
            );
          })}
        </g>

        {/* One tiny sparkle when surplus is healthy — very restrained */}
        {ratio > 0.7 && !over && (
          <g className="gm-sparkles" style={{ opacity: Math.min(0.75, (ratio - 0.7) / 0.25) }}>
            <circle cx={VIEW_W - 18} cy={10} r="1.4" fill="#FFFCF5" opacity="0.9" />
            <circle cx={VIEW_W - 18} cy={10} r="3.2" fill="#F5E6C8" opacity="0.35" />
          </g>
        )}
      </svg>
      <div className="gold-mountain-caption">
        <span className="gm-title">小金山 · 金砖</span>
        <span className="gm-remain">
          {over
            ? `已掏空 · 超 ${formatRmb(-remaining)}`
            : `还剩 ${formatRmb(remaining)} · ${visibleCount} 块`}
        </span>
      </div>
    </div>
  );
}

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
const BRICK_H = 12;
const GAP_X = 2.5;
const GAP_Y = 2.5;
const PAD_X = 8;
const VIEW_W = PAD_X * 2 + COLS * BRICK_W + (COLS - 1) * GAP_X;
const VIEW_H = 18 + ROWS * BRICK_H + (ROWS - 1) * GAP_Y + 22;

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
      const y = 14 + row * (BRICK_H + GAP_Y);
      const colT = (c / Math.max(1, colsInRow - 1)) * (0.06 / ROWS);
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
 * 小金山 — neat stacked gold bricks / 金砖 wall.
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
          <linearGradient id="gm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0" />
          </linearGradient>
          {/* Clean rectangular gold bars */}
          <linearGradient id="gm-brick-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF6DC" />
            <stop offset="35%" stopColor="#F0D78A" />
            <stop offset="100%" stopColor="#C9A24E" />
          </linearGradient>
          <linearGradient id="gm-brick-b" x1="0" y1="0" x2="0.08" y2="1">
            <stop offset="0%" stopColor="#FFF0C8" />
            <stop offset="40%" stopColor="#E8C56A" />
            <stop offset="100%" stopColor="#B89240" />
          </linearGradient>
          <linearGradient id="gm-brick-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE9B0" />
            <stop offset="45%" stopColor="#DDB856" />
            <stop offset="100%" stopColor="#A87E32" />
          </linearGradient>
          <linearGradient id="gm-brick-side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#7A5A18" stopOpacity="0.18" />
          </linearGradient>
          <filter id="gm-brick-soft" x="-8%" y="-12%" width="116%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#8B6914" floodOpacity="0.22" />
          </filter>
        </defs>

        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#gm-sky)" rx="14" />

        <g
          className="gm-heap"
          filter="url(#gm-brick-soft)"
          style={{ opacity: over ? 0.5 : 0.88 + ratio * 0.12 }}
        >
          {ALL_BRICKS.map((b, i) => {
            const on = ratio >= b.min || (over && b.min <= 0.02);
            const rx = 2.2;
            return (
              <g
                key={`${b.row}-${b.col}`}
                className={`gm-brick${on ? ' gm-brick--on' : ''}`}
                style={{
                  opacity: on ? 1 : 0,
                  transform: on ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.92)',
                  transformOrigin: `${b.x + BRICK_W / 2}px ${b.y + BRICK_H}px`,
                  transitionDelay: on ? `${Math.min(i * 12, 220)}ms` : '0ms',
                }}
              >
                {/* Main bar */}
                <rect
                  x={b.x}
                  y={b.y}
                  width={BRICK_W}
                  height={BRICK_H}
                  rx={rx}
                  fill={fills[b.shade]}
                  stroke="#C9A24E"
                  strokeOpacity="0.35"
                  strokeWidth="0.6"
                />
                {/* Top bevel shine */}
                <rect
                  x={b.x + 1.5}
                  y={b.y + 1.2}
                  width={BRICK_W - 3}
                  height={3.2}
                  rx={1.2}
                  fill="#FFFBEF"
                  opacity="0.55"
                />
                {/* Left highlight / right shade overlay */}
                <rect
                  x={b.x}
                  y={b.y}
                  width={BRICK_W}
                  height={BRICK_H}
                  rx={rx}
                  fill="url(#gm-brick-side)"
                  opacity="0.85"
                />
                {/* Thin bottom edge for depth */}
                <rect
                  x={b.x + 1}
                  y={b.y + BRICK_H - 2.2}
                  width={BRICK_W - 2}
                  height={1.4}
                  rx={0.6}
                  fill="#8B6914"
                  opacity="0.18"
                />
              </g>
            );
          })}
        </g>

        {ratio > 0.45 && !over && (
          <g className="gm-sparkles" style={{ opacity: Math.min(1, (ratio - 0.45) / 0.4) }}>
            <path
              d="M16 10 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1 Z"
              fill="#FFF8E7"
            />
            <path
              d={`M${VIEW_W - 20} 12 l0.85 2.2 2.2 0.85 -2.2 0.85 -0.85 2.2 -0.85 -2.2 -2.2 -0.85 2.2 -0.85 Z`}
              fill="#F5E6C8"
            />
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

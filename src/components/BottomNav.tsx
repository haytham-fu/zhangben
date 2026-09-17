import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { NavCuteIcon, type NavIconId } from './CuteIcons';

export type TabId = 'home' | 'calendar' | 'add' | 'wallets' | 'list' | 'settings';

const TABS: { id: TabId; icon: NavIconId; label: string }[] = [
  { id: 'home', icon: 'home', label: '总览' },
  { id: 'calendar', icon: 'calendar', label: '日历' },
  { id: 'add', icon: 'add', label: '记账' },
  { id: 'wallets', icon: 'wallets', label: '小荷包' },
  { id: 'list', icon: 'list', label: '流水明细' },
  { id: 'settings', icon: 'settings', label: '设置' },
];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

interface BlobRect {
  left: number;
  width: number;
  height: number;
  top: number;
}

const PAD_X = 4;
const PAD_Y = 3;

function rectForButton(nav: HTMLElement, btn: HTMLElement): BlobRect {
  const nr = nav.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  return {
    left: br.left - nr.left + PAD_X,
    width: Math.max(0, br.width - PAD_X * 2),
    height: Math.max(0, br.height - PAD_Y * 2),
    top: br.top - nr.top + PAD_Y,
  };
}

export function BottomNav({ active, onChange }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const btnRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const [blob, setBlob] = useState<BlobRect>({ left: 0, width: 0, height: 0, top: 0 });
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stretch, setStretch] = useState(1);
  const [travelDir, setTravelDir] = useState<1 | -1 | 0>(0);
  const reduceMotion = useRef(false);
  const prevActive = useRef(active);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    lastX: number;
    moved: boolean;
    base: BlobRect;
  } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion.current = mq.matches;
    const onMq = () => {
      reduceMotion.current = mq.matches;
    };
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  const measureActive = useCallback(() => {
    const nav = navRef.current;
    const btn = btnRefs.current[active];
    if (!nav || !btn) return;
    setBlob(rectForButton(nav, btn));
    setReady(true);
  }, [active]);

  useLayoutEffect(() => {
    if (dragging) return;
    measureActive();
  }, [measureActive, active, dragging]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => {
      if (!dragRef.current) measureActive();
    });
    ro.observe(nav);
    window.addEventListener('resize', measureActive);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureActive);
    };
  }, [measureActive]);

  // Morph stretch when tab changes (tap or snap)
  useEffect(() => {
    if (reduceMotion.current) {
      setBump(false);
      setStretch(1);
      setTravelDir(0);
      prevActive.current = active;
      return;
    }
    const prev = prevActive.current;
    prevActive.current = active;
    if (prev === active) return;

    const prevIdx = TABS.findIndex((t) => t.id === prev);
    const nextIdx = TABS.findIndex((t) => t.id === active);
    const dir: 1 | -1 | 0 =
      prevIdx < 0 || nextIdx < 0 ? 0 : nextIdx > prevIdx ? 1 : nextIdx < prevIdx ? -1 : 0;
    const dist = Math.min(3, Math.abs(nextIdx - prevIdx));
    setTravelDir(dir);
    setStretch(1 + 0.12 + dist * 0.06);
    setBump(false);
    const raf = window.requestAnimationFrame(() => setBump(true));
    const settle = window.setTimeout(() => {
      setStretch(1);
      setTravelDir(0);
    }, 300);
    const clearBump = window.setTimeout(() => setBump(false), 640);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.clearTimeout(clearBump);
    };
  }, [active]);

  const nearestTab = useCallback(
    (clientX: number): TabId => {
      let best: TabId = active;
      let bestDist = Infinity;
      for (const t of TABS) {
        const btn = btnRefs.current[t.id];
        if (!btn) continue;
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const d = Math.abs(cx - clientX);
        if (d < bestDist) {
          bestDist = d;
          best = t.id;
        }
      }
      return best;
    },
    [active],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const nav = navRef.current;
    if (!nav) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      moved: false,
      base: { ...blob },
    };
    suppressClick.current = false;
    try {
      nav.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const nav = navRef.current;
    if (!nav) return;

    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true;
    suppressClick.current = true;
    setDragging(true);

    const nr = nav.getBoundingClientRect();
    const w = drag.base.width;
    const center = e.clientX - nr.left;
    let left = center - w / 2;
    const minL = PAD_X;
    const maxL = Math.max(minL, nr.width - w - PAD_X);
    left = Math.max(minL, Math.min(maxL, left));

    const vel = e.clientX - drag.lastX;
    drag.lastX = e.clientX;
    const dir: 1 | -1 | 0 =
      vel > 0.5 ? 1 : vel < -0.5 ? -1 : dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stretchAmt = Math.min(
      1.38,
      1 + Math.abs(dx) / (nr.width * 0.9) + Math.min(0.12, Math.abs(vel) / 40),
    );

    setTravelDir(dir);
    setStretch(stretchAmt);
    setBlob({
      left,
      width: w,
      height: drag.base.height,
      top: drag.base.top,
    });
  };

  const endDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      navRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (!drag.moved) {
      setDragging(false);
      setStretch(1);
      setTravelDir(0);
      return;
    }

    const next = nearestTab(e.clientX);
    setDragging(false);
    if (next !== active) {
      onChange(next);
    } else {
      measureActive();
      setStretch(1.08);
      setBump(true);
      window.setTimeout(() => {
        setStretch(1);
        setBump(false);
        setTravelDir(0);
      }, 420);
    }
  };

  const onClickCapture = (e: ReactMouseEvent) => {
    if (!suppressClick.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick.current = false;
  };

  const scaleX = dragging || stretch !== 1 ? stretch : 1;
  const origin =
    travelDir > 0 ? 'left center' : travelDir < 0 ? 'right center' : 'center center';

  return (
    <nav
      ref={navRef}
      className="bottom-nav bottom-nav-6 liquid-dock"
      aria-label="主导航"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      <span
        className={[
          'dock-liquid-blob',
          ready ? 'dock-liquid-blob--ready' : '',
          bump ? 'dock-liquid-blob--bump' : '',
          dragging ? 'dock-liquid-blob--dragging' : '',
          stretch > 1.02 ? 'dock-liquid-blob--morph' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden
        style={{
          transform: `translate3d(${blob.left}px, ${blob.top}px, 0) scaleX(${scaleX})`,
          width: blob.width,
          height: blob.height,
          transformOrigin: origin,
        }}
      />
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          ref={(el) => {
            btnRefs.current[t.id] = el;
          }}
          className={`nav-item ${active === t.id ? 'active' : ''} ${
            active === t.id && bump ? 'nav-item--pop' : ''
          }`}
          onClick={() => onChange(t.id)}
        >
          <span className="nav-icon">
            <NavCuteIcon id={t.icon} size={24} />
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

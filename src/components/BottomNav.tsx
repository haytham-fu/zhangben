import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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

/**
 * Dock switching is button onClick only (reliable on iOS).
 * Liquid glass blob animates itself when `active` changes — no finger-drag / setPointerCapture.
 */
export function BottomNav({ active, onChange }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const btnRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const [blob, setBlob] = useState<BlobRect>({ left: 0, width: 0, height: 0, top: 0 });
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(false);
  const [stretch, setStretch] = useState(1);
  const [travelDir, setTravelDir] = useState<1 | -1 | 0>(0);
  const reduceMotion = useRef(false);
  const prevActive = useRef(active);

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
    measureActive();
  }, [measureActive, active]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => measureActive());
    ro.observe(nav);
    window.addEventListener('resize', measureActive);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureActive);
    };
  }, [measureActive]);

  // Morph stretch when tab changes via onClick
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

  const scaleX = stretch !== 1 ? stretch : 1;
  const origin =
    travelDir > 0 ? 'left center' : travelDir < 0 ? 'right center' : 'center center';

  return (
    <nav ref={navRef} className="bottom-nav bottom-nav-6 liquid-dock" aria-label="主导航">
      <span
        className={[
          'dock-liquid-blob',
          ready ? 'dock-liquid-blob--ready' : '',
          bump ? 'dock-liquid-blob--bump' : '',
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

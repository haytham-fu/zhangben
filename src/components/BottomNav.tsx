import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

export function BottomNav({ active, onChange }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const btnRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const [blob, setBlob] = useState<BlobRect>({ left: 0, width: 0, height: 0, top: 0 });
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(false);

  const measure = useCallback(() => {
    const nav = navRef.current;
    const btn = btnRefs.current[active];
    if (!nav || !btn) return;
    const nr = nav.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const padX = 4;
    const padY = 3;
    setBlob({
      left: br.left - nr.left + padX,
      width: Math.max(0, br.width - padX * 2),
      height: Math.max(0, br.height - padY * 2),
      top: br.top - nr.top + padY,
    });
    setReady(true);
  }, [active]);

  useLayoutEffect(() => {
    measure();
  }, [measure, active]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useEffect(() => {
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 420);
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <nav ref={navRef} className="bottom-nav bottom-nav-6 liquid-dock" aria-label="主导航">
      <span
        className={`dock-liquid-blob ${ready ? 'dock-liquid-blob--ready' : ''} ${bump ? 'dock-liquid-blob--bump' : ''}`}
        aria-hidden
        style={{
          transform: `translate3d(${blob.left}px, ${blob.top}px, 0)`,
          width: blob.width,
          height: blob.height,
        }}
      />
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          ref={(el) => {
            btnRefs.current[t.id] = el;
          }}
          className={`nav-item ${active === t.id ? 'active' : ''}`}
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

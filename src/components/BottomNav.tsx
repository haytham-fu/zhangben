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

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav bottom-nav-6" aria-label="主导航">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
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

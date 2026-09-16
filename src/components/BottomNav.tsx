export type TabId = 'home' | 'add' | 'list' | 'settings';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'home', icon: '📊', label: '总览' },
  { id: 'add', icon: '➕', label: '记账' },
  { id: 'list', icon: '📋', label: '流水' },
  { id: 'settings', icon: '⚙️', label: '设置' },
];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`nav-item ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="nav-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

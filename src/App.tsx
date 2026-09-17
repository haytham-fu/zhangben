import { useEffect, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { BottomNav, type TabId } from './components/BottomNav';
import { useStore } from './hooks/useStore';
import { useThemeAppearance } from './hooks/useThemeAppearance';
import { AddTransaction } from './pages/AddTransaction';
import { CalendarPage } from './pages/Calendar';
import { Dashboard } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';
import { TransactionList } from './pages/TransactionList';
import { WalletsPage } from './pages/Wallets';
import { consumeDeepLinkFromLocation, type DeepLinkAddPrefill } from './utils/deepLink';

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<TabId>('home');

  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const TAB_ORDER: TabId[] = ['home', 'calendar', 'add', 'wallets', 'list', 'settings'];

  function onShellTouchStart(e: ReactTouchEvent) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tch = e.changedTouches[0];
    if (!tch) return;
    swipeRef.current = { x: tch.clientX, y: tch.clientY, t: Date.now() };
  }

  function onShellTouchEnd(e: ReactTouchEvent) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const tch = e.changedTouches[0];
    if (!tch) return;
    const dx = tch.clientX - start.x;
    const dy = tch.clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt > 650 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    // Ignore swipes that begin near the dock (dock has its own follow)
    if (tch.clientY > window.innerHeight - 96) return;
    const idx = TAB_ORDER.indexOf(tab);
    if (idx < 0) return;
    if (dx < 0 && idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]);
    else if (dx > 0 && idx > 0) setTab(TAB_ORDER[idx - 1]);
  }

  const [deepLink, setDeepLink] = useState<DeepLinkAddPrefill | null>(null);
  const appearance = useThemeAppearance(
    store.settings.themePalette ?? 'sky',
    store.settings.bgMotion ?? 'dynamic',
  );

  useEffect(() => {
    const prefill = consumeDeepLinkFromLocation();
    if (!prefill) return;
    setDeepLink(prefill);
    setTab('add');
  }, []);

  // Keep pages mounted so derived budget/calendar figures stay live when adding txs
  // (hidden tabs still receive store updates; only the active page is shown).
  return (
    <div className="app-shell" onTouchStart={onShellTouchStart} onTouchEnd={onShellTouchEnd}>
      <header className="app-header">
        <div>
          <h1>账本</h1>
          <p className="subtitle">
            本地记账 · {store.settings.basicBudget} + {store.settings.specialBudget}
          </p>
        </div>
      </header>

      <div className={`page-view ${tab === 'home' ? '' : 'page-view--hidden'}`} aria-hidden={tab !== 'home'}>
        <Dashboard
          store={store}
          onOpenTx={() => setTab('list')}
          adviceAnimated={appearance.adviceAnimated}
        />
      </div>
      <div
        className={`page-view ${tab === 'calendar' ? '' : 'page-view--hidden'}`}
        aria-hidden={tab !== 'calendar'}
      >
        <CalendarPage store={store} />
      </div>
      <div className={`page-view ${tab === 'add' ? '' : 'page-view--hidden'}`} aria-hidden={tab !== 'add'}>
        <AddTransaction
          store={store}
          onDone={() => setTab('home')}
          deepLink={deepLink}
          onDeepLinkConsumed={() => setDeepLink(null)}
        />
      </div>
      <div
        className={`page-view ${tab === 'wallets' ? '' : 'page-view--hidden'}`}
        aria-hidden={tab !== 'wallets'}
      >
        <WalletsPage store={store} />
      </div>
      <div className={`page-view ${tab === 'list' ? '' : 'page-view--hidden'}`} aria-hidden={tab !== 'list'}>
        <TransactionList store={store} />
      </div>
      <div
        className={`page-view ${tab === 'settings' ? '' : 'page-view--hidden'}`}
        aria-hidden={tab !== 'settings'}
      >
        <SettingsPage store={store} />
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

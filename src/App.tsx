import { useEffect, useState } from 'react';
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>账本</h1>
          <p className="subtitle">本地记账 · 3500 + 1500</p>
        </div>
      </header>

      <div key={tab} className="page-view">
        {tab === 'home' && (
          <Dashboard
            store={store}
            onOpenTx={() => setTab('list')}
            adviceAnimated={appearance.adviceAnimated}
          />
        )}
        {tab === 'calendar' && <CalendarPage store={store} />}
        {tab === 'add' && (
          <AddTransaction
            store={store}
            onDone={() => setTab('home')}
            deepLink={deepLink}
            onDeepLinkConsumed={() => setDeepLink(null)}
          />
        )}
        {tab === 'wallets' && <WalletsPage store={store} />}
        {tab === 'list' && <TransactionList store={store} />}
        {tab === 'settings' && <SettingsPage store={store} />}
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

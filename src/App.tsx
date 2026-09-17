import { useEffect, useRef, useState } from 'react';
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
import { consumePairCodeFromLocation, fetchSyncPackFromUrl } from './utils/sync';

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<TabId>('home');

  const [deepLink, setDeepLink] = useState<DeepLinkAddPrefill | null>(null);
  const appearance = useThemeAppearance(
    store.settings.themePalette ?? 'sky',
    store.settings.bgMotion ?? 'dynamic',
  );
  const autoPullDone = useRef(false);

  useEffect(() => {
    const pair = consumePairCodeFromLocation();
    if (pair) {
      // Settings page also reads pair from session via its own consume — already consumed here.
      // Stash for Settings via sessionStorage so Settings can still see it.
      try {
        sessionStorage.setItem('zhangben-pending-pair', pair);
      } catch {
        /* ignore */
      }
      setTab('settings');
      return;
    }
    const prefill = consumeDeepLinkFromLocation();
    if (!prefill) return;
    setDeepLink(prefill);
    setTab('add');
  }, []);

  // Optional auto-pull from saved sync URL (once per open)
  useEffect(() => {
    if (autoPullDone.current) return;
    if (!store.settings.autoPullSync) return;
    const url = store.settings.lastSyncUrl?.trim();
    if (!url) return;
    autoPullDone.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const parsed = await fetchSyncPackFromUrl(url);
        if (cancelled) return;
        store.applySyncPack(parsed.state, 'merge');
      } catch {
        /* silent — user can sync manually in 关联设备 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store.settings.autoPullSync, store.settings.lastSyncUrl, store]);

  const budgetsUnset =
    (store.settings.basicBudget ?? 0) <= 0 && (store.settings.specialBudget ?? 0) <= 0;
  const remain = store.monthStats.totalRemain;
  const subtitle = budgetsUnset
    ? '本地记账 · 预算未设置'
    : `本地记账 · 剩余 ¥${remain.toFixed(2)}`;

  // Keep pages mounted so derived budget/calendar figures stay live when adding txs
  // (hidden tabs still receive store updates; only the active page is shown).
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>账本</h1>
          <p className="subtitle">{subtitle}</p>
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

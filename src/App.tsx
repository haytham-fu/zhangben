import { useEffect, useState } from 'react';
import { BottomNav, type TabId } from './components/BottomNav';
import { IconEdit } from './components/CuteIcons';
import { useStore } from './hooks/useStore';
import { AddTransaction } from './pages/AddTransaction';
import { CalendarPage } from './pages/Calendar';
import { Dashboard } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';
import { TransactionList } from './pages/TransactionList';

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<TabId>('home');

  useEffect(() => {
    store.ensureMusicMembership(store.currentYm);
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>账本</h1>
          <p className="subtitle">本地记账 · 3500 + 1500</p>
        </div>
        <button type="button" className="btn-icon" aria-label="去记账" onClick={() => setTab('add')}>
          <IconEdit size={22} />
        </button>
      </header>

      <div key={tab} className="page-view">
        {tab === 'home' && (
          <Dashboard store={store} onAdd={() => setTab('add')} onOpenTx={() => setTab('list')} />
        )}
        {tab === 'calendar' && <CalendarPage store={store} />}
        {tab === 'add' && <AddTransaction store={store} onDone={() => setTab('home')} />}
        {tab === 'list' && <TransactionList store={store} />}
        {tab === 'settings' && <SettingsPage store={store} />}
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { BottomNav, type TabId } from './components/BottomNav';
import { useStore } from './hooks/useStore';
import { AddTransaction } from './pages/AddTransaction';
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
          ✏️
        </button>
      </header>

      {tab === 'home' && (
        <Dashboard store={store} onAdd={() => setTab('add')} onOpenTx={() => setTab('list')} />
      )}
      {tab === 'add' && <AddTransaction store={store} onDone={() => setTab('home')} />}
      {tab === 'list' && <TransactionList store={store} />}
      {tab === 'settings' && <SettingsPage store={store} />}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

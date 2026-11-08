import { useCallback, useState } from 'react';
import { SectionNav, type Section } from './components/SectionNav';
import { DashboardScreen } from './screens/DashboardScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { readPref, savePref } from './prefs';
import type { OrdersFilter } from './types';

// Два раздела: «Заказы» и «Дашборд». Оба остаются в памяти, когда скрыты, —
// переключение мгновенное, список заказов не грузится заново. Последний раздел запоминаем.
export function App() {
  const [section, setSection] = useState<Section>(() => readPref('section', ['orders', 'dashboard'] as const, 'orders'));
  const [filter, setFilter] = useState<OrdersFilter | null>(null);

  const go = useCallback((s: Section) => {
    setSection(s);
    savePref('section', s);
    window.scrollTo(0, 0);
  }, []);
  // С дашборда: «покажи эти заказы» → раздел «Заказы» с фильтром.
  const openOrders = useCallback((f: OrdersFilter) => {
    setFilter(f);
    go('orders');
  }, [go]);
  const clearFilter = useCallback(() => setFilter(null), []);
  const backToDashboard = useCallback(() => { setFilter(null); go('dashboard'); }, [go]);

  const nav = <SectionNav current={section} onChange={s => { setFilter(null); go(s); }} />;
  return (
    <>
      <div hidden={section !== 'orders'}>
        <OrdersScreen nav={nav} filter={filter} onClearFilter={clearFilter} onBackToDashboard={backToDashboard} />
      </div>
      <div hidden={section !== 'dashboard'}>
        <DashboardScreen nav={nav} active={section === 'dashboard'} onOpenOrders={openOrders} />
      </div>
    </>
  );
}

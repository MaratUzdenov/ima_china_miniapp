import { useCallback, useMemo, useState } from 'react';
import { SectionNav, type Section } from './components/SectionNav';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { readPref, savePref } from './prefs';
import type { OrdersFilter } from './types';

// Три раздела: «Заказы», «Товары» и «Дашборд». Оба остаются в памяти, когда скрыты, —
// переключение мгновенное, список заказов не грузится заново. Последний раздел запоминаем.
export function App() {
  const [section, setSection] = useState<Section>(() => readPref('section', ['orders', 'products', 'dashboard'] as const, 'orders'));
  const [filter, setFilter] = useState<OrdersFilter | null>(null);
  const [filterFrom, setFilterFrom] = useState<Section>('dashboard'); // откуда пришли с фильтром — туда и «‹ Назад»

  const go = useCallback((s: Section) => {
    setSection(s);
    savePref('section', s);
    window.scrollTo(0, 0);
  }, []);
  // С дашборда или «Товаров»: «покажи эти заказы» → раздел «Заказы» с фильтром.
  const openOrdersFrom = useCallback((from: Section) => (f: OrdersFilter) => {
    setFilter(f);
    setFilterFrom(from);
    go('orders');
  }, [go]);
  const fromDashboard = useMemo(() => openOrdersFrom('dashboard'), [openOrdersFrom]);
  const fromProducts = useMemo(() => openOrdersFrom('products'), [openOrdersFrom]);
  const clearFilter = useCallback(() => setFilter(null), []);
  const backFromFilter = useCallback(() => { setFilter(null); go(filterFrom); }, [go, filterFrom]);

  const nav = <SectionNav current={section} onChange={s => { setFilter(null); go(s); }} />;
  return (
    <>
      <div hidden={section !== 'orders'}>
        <OrdersScreen nav={nav} filter={filter} onClearFilter={clearFilter} onBack={backFromFilter} backLabel={filterFrom === 'products' ? '‹ Товары' : '‹ Дашборд'} />
      </div>
      <div hidden={section !== 'products'}>
        <ProductsScreen nav={nav} active={section === 'products'} onOpenOrders={fromProducts} />
      </div>
      <div hidden={section !== 'dashboard'}>
        <DashboardScreen nav={nav} active={section === 'dashboard'} onOpenOrders={fromDashboard} />
      </div>
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, demoMode, fetchOrders } from '../api';
import { OrderGroupCard } from '../components/OrderGroupCard';
import { EmptyState, ErrorState, SkeletonList } from '../components/States';
import { norm, todayIso } from '../format';
import type { Order, OrdersList } from '../types';

type Tab = 'active' | 'delivered' | 'all';
const TABS: { key: Tab; title: string }[] = [
  { key: 'active', title: 'В работе' },
  { key: 'delivered', title: 'Доставлены' },
  { key: 'all', title: 'Все' },
];

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: OrdersList };

// Товары одного заказа — вместе. Порядок групп — по самому новому товару (новые сверху, как в боте).
function groupOrders(orders: Order[]): Order[][] {
  const groups = new Map<string, Order[]>();
  orders.forEach(o => {
    const g = groups.get(o.groupId);
    if (g) g.push(o); else groups.set(o.groupId, [o]);
  });
  return [...groups.values()].map(items =>
    items.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.row - b.row));
}

function matchesTab(o: Order, tab: Tab, delivered: string): boolean {
  if (tab === 'active') return !o.isFinal;
  if (tab === 'delivered') return o.status === delivered;
  return true;
}

function matchesQuery(o: Order, q: string): boolean {
  return !q || [o.id, o.client, o.item, o.track].some(v => norm(v).includes(q));
}

export function OrdersScreen() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');

  const reload = useCallback(() => {
    setLoad({ state: 'loading' });
    fetchOrders()
      .then(data => setLoad({ state: 'ready', data }))
      .catch(err => setLoad({ state: 'error', message: err instanceof ApiError ? err.message : 'Неизвестная ошибка. Нажмите «Повторить».' }));
  }, []);
  useEffect(reload, [reload]);

  const view = useMemo(() => {
    if (load.state !== 'ready') return null;
    const { orders, statuses, finalStatuses } = load.data;
    const delivered = finalStatuses[0];
    // Основная цепочка — от первого статуса до «Доставлен»; всё после него — побочные (Проблема, Отменён).
    const chain = statuses.slice(0, statuses.indexOf(delivered) + 1);
    const q = norm(query);
    const counts = Object.fromEntries(TABS.map(t => [t.key, orders.filter(o => matchesTab(o, t.key, delivered)).length])) as Record<Tab, number>;
    const filtered = orders.filter(o => matchesTab(o, tab, delivered) && matchesQuery(o, q));
    return { chain, counts, groups: groupOrders(filtered), total: orders.length };
  }, [load, tab, query]);

  const today = todayIso();

  return (
    <div className="screen">
      <div className="toolbar">
        <input
          className="search"
          type="search"
          inputMode="search"
          placeholder="Поиск: товар, клиент, ID, трек"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={'tab' + (tab === t.key ? ' tab--on' : '')}
              onClick={() => setTab(t.key)}
            >
              {t.title}{view ? ` ${view.counts[t.key]}` : ''}
            </button>
          ))}
        </div>
      </div>

      {demoMode && (
        <div className="banner">Демо-данные: таблица ещё не подключена. Настоящие заказы появятся после подключения API.</div>
      )}

      {load.state === 'loading' && <SkeletonList />}
      {load.state === 'error' && <ErrorState message={load.message} onRetry={reload} />}
      {view && view.total === 0 && (
        <EmptyState title="Пока нет заказов" hint="Внесите первый заказ в боте строкой «Елена, Москва, 1000 гвозди» — он появится здесь." />
      )}
      {view && view.total > 0 && view.groups.length === 0 && (
        <EmptyState
          title={query ? 'Ничего не нашлось' : 'Здесь пусто'}
          hint={query ? 'Попробуйте часть слова, например «гвозд», или вкладку «Все».' : 'Загляните во вкладку «Все».'}
        />
      )}
      {view && view.groups.length > 0 && (
        <div className="list">
          {view.groups.map(items => (
            <OrderGroupCard key={items[0].groupId} items={items} chain={view.chain} today={today} />
          ))}
          <button className="button button--ghost" onClick={reload}>Обновить</button>
        </div>
      )}
    </div>
  );
}

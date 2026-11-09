import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, demoMode, fetchOrders, markDashboardStale } from '../api';
import { OrderGroupCard } from '../components/OrderGroupCard';
import { EmptyState, ErrorState, SkeletonList } from '../components/States';
import { OrderDetails } from './OrderDetails';
import { NewOrder } from './NewOrder';
import { norm, todayIso } from '../format';
import type { DeleteResult, Order, OrdersFilter, OrdersList } from '../types';

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

interface Props {
  nav?: ReactNode;                    // нижняя панель «Заказы / Дашборд»
  filter?: OrdersFilter | null;       // пришли с дашборда: показать только эти заказы
  onClearFilter?: () => void;
  onBackToDashboard?: () => void;
}

export function OrdersScreen({ nav, filter = null, onClearFilter, onBackToDashboard }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const closeNew = useCallback(() => setCreating(false), []);
  const listScroll = useRef(0); // где был список, чтобы вернуться на то же место

  const openOrder = useCallback((o: Order) => {
    listScroll.current = window.scrollY;
    setOpenedId(o.id);
  }, []);
  const closeOrder = useCallback(() => setOpenedId(null), []);
  // После записи в таблицу подменяем заказ в списке — без повторной загрузки всего списка.
  const updateOrder = useCallback((fresh: Order) => {
    markDashboardStale(); // цифры дашборда поменялись — при открытии он попросит свежие
    setLoad(prev => prev.state !== 'ready' ? prev : {
      state: 'ready',
      data: { ...prev.data, orders: prev.data.orders.map(o => (o.id === fresh.id ? fresh : o)) },
    });
  }, []);
  // Удалили заказ: убираем из списка, а строки ниже сдвигаем на одну вверх — так же, как в таблице.
  // Перезагружать весь список не нужно.
  const [listNotice, setListNotice] = useState('');
  const removeOrder = useCallback((r: DeleteResult) => {
    markDashboardStale();
    setLoad(prev => {
      if (prev.state !== 'ready') return prev;
      const gone = prev.data.orders.find(o => o.id === r.id);
      const removedRow = gone ? gone.row : r.row;
      return { state: 'ready', data: { ...prev.data, orders: prev.data.orders
        .filter(o => o.id !== r.id)
        .map(o => (r.duplicate || o.row <= removedRow ? o : { ...o, row: o.row - 1 })) } };
    });
    setOpenedId(null);
    setListNotice('🗑 Заказ ' + r.id + ' удалён. Копия — на листе «Удалённые».');
  }, []);
  useEffect(() => {
    if (openedId === null) requestAnimationFrame(() => window.scrollTo(0, listScroll.current));
  }, [openedId]);

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
    // Фильтр с дашборда — по всем заказам, без вкладок.
    const filtered = orders.filter(o => (filter ? filter.match(o) : matchesTab(o, tab, delivered)) && matchesQuery(o, q));
    return { chain, counts, groups: groupOrders(filtered), total: orders.length };
  }, [load, tab, query, filter]);

  const today = todayIso();

  if (creating) return <NewOrder onClose={closeNew} onCreated={() => { markDashboardStale(); reload(); }} />;

  const opened = openedId && load.state === 'ready' ? load.data.orders.find(o => o.id === openedId) : undefined;
  if (opened && view && load.state === 'ready') {
    const groupSize = load.data.orders.filter(o => o.groupId === opened.groupId).length;
    return <OrderDetails order={opened} chain={view.chain} statuses={load.data.statuses} onBack={closeOrder}
      onOrderUpdated={updateOrder} onOrderDeleted={removeOrder} groupSize={groupSize} />;
  }

  return (
    <div className={'screen' + (nav ? ' screen--tabbar' : '')}>
      {nav}
      <div className="toolbar">
        <button className="button new-order" onClick={() => setCreating(true)}>➕ Новый заказ</button>
        <input
          className="search"
          type="search"
          inputMode="search"
          placeholder="Поиск: товар, клиент, ID, трек"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {filter ? (
          <div className="filter-bar">
            <button className="link" onClick={onBackToDashboard}>‹ Дашборд</button>
            <span className="filter-bar__title">{filter.title}{view ? ' · ' + view.groups.reduce((n, g) => n + g.length, 0) : ''}</span>
            <button className="link" onClick={onClearFilter} aria-label="Сбросить фильтр">✕ Все</button>
          </div>
        ) : (
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
        )}
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
          hint={query ? 'Попробуйте часть слова, например «гвозд», или вкладку «Все».'
            : filter ? 'Похоже, эти заказы уже поправили. Нажмите «✕ Все» или обновите дашборд.' : 'Загляните во вкладку «Все».'}
        />
      )}
      {listNotice && (
        <div className="notice list-notice">{listNotice} <button className="link" onClick={() => setListNotice('')} aria-label="Скрыть">✕</button></div>
      )}
      {view && view.groups.length > 0 && (
        <div className="list">
          {view.groups.map(items => (
            <OrderGroupCard key={items[0].groupId} items={items} chain={view.chain} today={today} onOpen={openOrder} />
          ))}
          <button className="button button--ghost" onClick={reload}>Обновить</button>
        </div>
      )}
    </div>
  );
}

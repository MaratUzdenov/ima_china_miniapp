import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, demoMode, emitOrdersChanged, fetchProducts, renameProduct } from '../api';
import { ErrorState } from '../components/States';
import { HelpTip } from '../components/HelpTip';
import { norm, plural, rub, shortDate, shortDateTime } from '../format';
import { readPref, savePref } from '../prefs';
import { notifySuccess, useTelegramBack } from '../telegram';
import type { Order, OrdersFilter, Product, ProductsList } from '../types';

// Вкладка «Товары»: что заказывают чаще всего и сколько на этом заработали.
// Цифры считает бэкенд (Products.gs) — те же, что на листе «Товары» и в боте.
// Нажали на товар — «Заказы» с этим товаром. «✏️» — переименовать / склеить разные написания.

type Sort = 'orders' | 'earned';
const SORTS: { key: Sort; title: string }[] = [
  { key: 'orders', title: 'Чаще заказывают' },
  { key: 'earned', title: 'Больше заработали' },
];
const STALE_AFTER_MS = 90_000; // бэкенд помнит список столько же
const errorText = (err: unknown) => {
  if (!(err instanceof ApiError)) return 'Неизвестная ошибка. Нажмите «Повторить».';
  // Сайт обновился раньше, чем Apps Script, — объясняем по-человечески.
  if (/Неизвестный метод/.test(err.message)) return 'Товары появятся после обновления Apps Script: файл Products и «Новая версия» развёртывания.';
  return err.message;
};

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: ProductsList; refreshing: boolean };

interface Props { nav: ReactNode; active: boolean; onOpenOrders: (f: OrdersFilter) => void }

export const productFilter = (p: Pick<Product, 'key' | 'name'>): OrdersFilter => ({
  title: 'Товар: ' + p.name,
  match: (o: Order) => norm(o.item) === p.key,
});

export function ProductsScreen({ nav, active, onOpenOrders }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>(() => readPref('productsSort', ['orders', 'earned'] as const, 'orders'));
  const [renaming, setRenaming] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const loadedAt = useRef(0);
  const listScroll = useRef(0);

  const fetchData = useCallback((refresh: boolean) => {
    setLoad(prev => (prev.state === 'ready' ? { ...prev, refreshing: true } : { state: 'loading' }));
    fetchProducts(refresh)
      .then(data => { loadedAt.current = Date.now(); setLoad({ state: 'ready', data, refreshing: false }); })
      .catch(err => setLoad({ state: 'error', message: errorText(err) }));
  }, []);

  useEffect(() => {
    if (active && (!loadedAt.current || Date.now() - loadedAt.current > STALE_AFTER_MS)) fetchData(false);
  }, [active, fetchData]);

  const shown = useMemo(() => {
    if (load.state !== 'ready') return [];
    const q = norm(query);
    const list = load.data.products.filter(p => !q || p.key.includes(q));
    return sort === 'earned' ? [...list].sort((a, b) => (b.earned + b.expected) - (a.earned + a.expected) || b.orders - a.orders) : list;
  }, [load, query, sort]);

  if (renaming && load.state === 'ready') {
    return (
      <RenameProduct product={renaming} all={load.data.products}
        onCancel={() => { setRenaming(null); requestAnimationFrame(() => window.scrollTo(0, listScroll.current)); }}
        onDone={(text, orders) => {
          emitOrdersChanged(orders);
          setRenaming(null);
          setNotice(text);
          fetchData(true);
        }} />
    );
  }

  return (
    <div className="screen screen--tabbar">
      {nav}
      <div className="toolbar">
        <input className="search" type="search" placeholder="Поиск товара" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="tabs" role="tablist">
          {SORTS.map(s => (
            <button key={s.key} role="tab" aria-selected={sort === s.key} className={'tab' + (sort === s.key ? ' tab--on' : '')}
              onClick={() => { setSort(s.key); savePref('productsSort', s.key); }}>{s.title}</button>
          ))}
        </div>
      </div>
      {demoMode && <div className="banner">Демо-данные: таблица ещё не подключена.</div>}
      {notice && <div className="notice list-notice">{notice} <button className="link" onClick={() => setNotice('')} aria-label="Скрыть">✕</button></div>}

      {load.state === 'loading' && (
        <div className="list" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="card skeleton"><div className="skeleton__line" /><div className="skeleton__line skeleton__line--short" /></div>)}</div>
      )}
      {load.state === 'error' && <ErrorState message={load.message} onRetry={() => fetchData(true)} />}
      {load.state === 'ready' && (
        <>
          <div className="dash__updated">
            <span>
              {load.refreshing ? 'Обновляю…' : `${load.data.products.length} ${plural(load.data.products.length, 'товар', 'товара', 'товаров')} · обновлено ${shortDateTime(load.data.updatedAt)}`}
            </span>
            <span className="products__help">
              <HelpTip label="Как считаются товары"
                text="Товар — одинаковое название в заказах (без учёта больших букв). «Заработано» — прибыль выданных заказов, «ожидается» — заказов в работе. Отменённые не считаются. Если один товар записан по-разному — нажмите ✏️ и переименуйте: заказы склеятся." />
              <button className="link dash__refresh" onClick={() => fetchData(true)} disabled={load.refreshing}>Обновить</button>
            </span>
          </div>
          {shown.length === 0 ? (
            <div className="state">
              <div className="state__icon">🛍</div>
              <div className="state__title">{query ? 'Такого товара нет' : 'Пока нет товаров'}</div>
              <div className="state__hint">{query ? 'Попробуйте часть слова, например «генер».' : 'Товары появятся, когда вы внесёте первый заказ.'}</div>
            </div>
          ) : (
            <div className="list">
              {shown.map((p, i) => (
                <ProductCard key={p.key} p={p} rank={sort === 'orders' && !query ? i + 1 : 0}
                  onOpen={() => onOpenOrders(productFilter(p))}
                  onRename={() => { listScroll.current = window.scrollY; setRenaming(p); setNotice(''); }} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductCard({ p, rank, onOpen, onRename }: { p: Product; rank: number; onOpen: () => void; onRename: () => void }) {
  return (
    <div className="card product">
      <button className="product__main" onClick={onOpen}>
        <span className="product__title">{rank > 0 && rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] + ' ' : ''}{p.name}</span>
        <span className="product__stats">
          <b>{p.orders}</b> {plural(p.orders, 'заказ', 'заказа', 'заказов')}
          {p.qty > 0 && <> · {p.qty} шт.</>}
          {' · '}{p.clients} {plural(p.clients, 'клиент', 'клиента', 'клиентов')}
          {p.inWork > 0 && <> · в работе {p.inWork}</>}
        </span>
        <span className="product__money">
          <span>Заработано <b>{rub(p.earned)}</b></span>
          {p.expected !== 0 && <span>ожидается {rub(p.expected)}</span>}
        </span>
        {(p.noProfit > 0 || p.cancelled > 0 || p.lastDate) && (
          <span className="product__meta">
            {p.lastDate && <>последний заказ {shortDate(p.lastDate)}</>}
            {p.noProfit > 0 && <> · прибыль не посчитана в {p.noProfit}</>}
            {p.cancelled > 0 && <> · отменено {p.cancelled}</>}
          </span>
        )}
      </button>
      <button className="product__edit" onClick={onRename} aria-label={'Переименовать товар ' + p.name}>✏️</button>
    </div>
  );
}

// Переименовать товар во всех заказах. Если выбрать существующее название — товары склеятся в один.
function RenameProduct({ product: p, all, onCancel, onDone }: {
  product: Product; all: Product[]; onCancel: () => void; onDone: (text: string, orders: Order[]) => void;
}) {
  const [name, setName] = useState(p.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => useTelegramBack(saving ? null : onCancel), [saving, onCancel]);

  const target = all.find(x => x.key === norm(name) && x.key !== p.key);
  const similar = useMemo(() => {
    // Похожие названия: совпадает первое слово — чаще всего это и есть разные написания одного товара.
    const first = p.key.split(' ')[0];
    const q = norm(name);
    return all.filter(x => x.key !== p.key && (x.key.split(' ')[0] === first || (q.length >= 2 && x.key.includes(q)))).slice(0, 8);
  }, [all, p, name]);
  const unchanged = name.trim() === p.name || !name.trim();

  const save = () => {
    setSaving(true);
    setError('');
    renameProduct(p.name, name.trim())
      .then(r => {
        notifySuccess();
        onDone(r.merged ? `🛍 Склеено: ${r.matched} ${plural(r.matched, 'заказ', 'заказа', 'заказов')} теперь «${r.name}».`
          : `✏️ Переименовано в ${r.matched} ${plural(r.matched, 'заказе', 'заказах', 'заказах')}: «${r.name}».`, r.orders);
      })
      .catch(err => { setSaving(false); setError(errorText(err)); });
  };

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="details__title">✏️ Переименовать товар</div>
        <div className="details__client">Сейчас: «{p.name}» · {p.orders + p.cancelled} {plural(p.orders + p.cancelled, 'заказ', 'заказа', 'заказов')}</div>
        <input className="search field-gap" value={name} disabled={saving} autoComplete="off" onChange={e => setName(e.target.value)} />
        {similar.length > 0 && (
          <>
            <div className="details__note">Это тот же товар? Выберите — заказы склеятся:</div>
            <div className="options">
              {similar.map(x => (
                <button key={x.key} className="option" onClick={() => setName(x.name)} disabled={saving}>
                  {x.name} · {x.orders} {plural(x.orders, 'заказ', 'заказа', 'заказов')}
                </button>
              ))}
            </div>
          </>
        )}
        {target && <div className="notice">Такой товар уже есть ({target.orders} {plural(target.orders, 'заказ', 'заказа', 'заказов')}) — после сохранения это будет один товар.</div>}
        <div className="details__note">Название поменяется во всех заказах этого товара, в таблице и в боте. Каждая правка — в «Лог».</div>
        {error && <div className="notice notice--error">{error}</div>}
        <div className="actions">
          <button className="button" onClick={save} disabled={saving || unchanged}>{saving ? 'Сохраняю…' : target ? '🛍 Склеить' : 'Сохранить'}</button>
          <button className="button button--secondary" onClick={onCancel} disabled={saving}>Отмена</button>
        </div>
      </section>
    </div>
  );
}

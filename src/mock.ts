import type { Timeline, DashboardData, DashboardPeriod, FieldMeta, FieldsMeta, Order, OrderFormData, OrdersList } from './types';

// Демо-данные в том же формате, что отдаёт Api.gs. Нужны, пока API не подключён, и для проверки в браузере.
const STATUSES = ['Принят', 'Оплачен', 'Выкуплен', 'На складе в Китае', 'В пути',
  'На таможне', 'Готов к выдаче', 'Доставлен', 'Проблема', 'Отменён'];

function order(p: Partial<Order> & { id: string; row: number }): Order {
  // «Кто платит» в таблице считается из схемы оплаты — в демо так же.
  const scheme = p.scheme === undefined ? 'Предоплата 100%' : p.scheme;
  const payer = !scheme ? null : /карго/i.test(scheme) ? 'Карго' : 'Клиент';
  return {
    payer,
    date: null, createdAt: null, createdBy: 'Марат', client: null, tgId: null, shipType: 'Посылка физлицу',
    scheme: 'Предоплата 100%', item: null, link: null, variant: null, qty: null, priceCny: null, weight: null,
    method: 'Авиа', pickup: 'Черкесск', priceEst: null, priceFact: null, profit: null, expected: null, paid: null,
    due: null, status: 'Принят', statusDate: null, track: null, eta: null, deliveredDate: null, comment: null,
    tgConnected: false, hasSupplierLink: false, isFinal: false, groupId: p.id,
    ...p,
  };
}

export function demoOrders(): OrdersList {
  const orders: Order[] = [
    order({ row: 8, id: 'A-20261108-01', date: '2026-11-08', createdAt: '2026-11-08T09:40:00', client: 'Елена (Москва)',
      tgConnected: true, tgId: '100200300', item: 'Шурупы 30 мм', qty: 500, status: 'Принят', pickup: 'Москва', weight: 4,
      priceEst: 2600, expected: 2600, due: 2600 }),
    order({ row: 7, id: 'A-20261107-02', date: '2026-11-07', createdAt: '2026-11-07T10:20:00', client: 'Ахмат (Теберда)',
      item: 'Шлем для квадроцикла', qty: 1, status: 'Принят', weight: null, priceEst: 'Укажите вес', due: 'Выберите схему оплаты',
      scheme: null, groupId: 'A-20261107-01', comment: 'Внесено через бота · вместе с заказом A-20261107-01' }),
    order({ row: 6, id: 'A-20261107-01', date: '2026-11-07', createdAt: '2026-11-07T10:15:00', client: 'Ахмат (Теберда)',
      item: 'Квадроцикл 125cc', qty: 1, status: 'Оплачен', weight: 85, priceCny: 3200, link: 'https://detail.1688.com/offer/1.html',
      hasSupplierLink: true, priceEst: 74500, expected: 74500, paid: 74500, due: 0, profit: 8900, eta: '2026-11-19' }),
    order({ row: 5, id: 'A-20261106-03', date: '2026-11-06', createdAt: '2026-11-06T18:02:00', client: 'Елена (Москва)',
      tgConnected: true, tgId: '100200300', item: 'Гвозди 50 мм', qty: 1000, status: 'В пути', pickup: 'Москва', weight: 12.5,
      link: 'https://item.taobao.com/item.htm?id=2', hasSupplierLink: true, priceFact: 9800, expected: 9800, paid: 5000, due: 4800,
      profit: 1450, track: 'YT123456789CN', eta: '2026-11-04', method: 'Авто' }),
    order({ row: 4, id: 'A-20261105-01', date: '2026-11-05', createdAt: '2026-11-05T12:00:00', client: 'Ислам Байрамуков',
      item: 'Чехлы для телефона', qty: 300, status: 'Проблема', shipType: 'Коммерческая партия', scheme: 'Через карго (комиссия от карго)',
      weight: 0, priceEst: 'Укажите вес', profit: 3000, expected: 3000, due: 3000, comment: 'Поставщик не отвечает 3 дня' }),
    order({ row: 3, id: 'A-20261102-01', date: '2026-11-02', createdAt: '2026-11-02T09:30:00', client: 'Мадина (Черкесск)',
      tgConnected: true, item: 'Кроссовки белые', variant: '38', qty: 2, status: 'Доставлен', isFinal: true, weight: 2.4,
      link: 'https://detail.1688.com/offer/3.html', hasSupplierLink: true, priceFact: 6800, expected: 6800, paid: 6800, due: 0,
      profit: -350, deliveredDate: '2026-11-06' }),
    order({ row: 2, id: 'A-20261101-01', date: '2026-11-01', createdAt: '2026-11-01T08:00:00', client: 'Тест Петров',
      item: 'Футболки', qty: 100, status: 'Отменён', isFinal: true, due: 0, expected: 0 }),
  ];
  return {
    orders, statuses: STATUSES, finalStatuses: ['Доставлен', 'Отменён'],
    lists: { method: ['Авиа', 'Авто', 'ЖД', 'Море'], pickup: ['Черкесск', 'Москва'] },
    serverTime: '2026-11-07T12:00',
  };
}

// Демо-описание полей — как EDIT_GROUPS в Edit.gs. В рабочем режиме приходит с бэкенда.
export function demoFieldsMeta(): FieldsMeta {
  const f = (key: string, title: string, kind: FieldMeta['kind'], options: string[] = [], clearable = true): FieldMeta =>
    ({ key, title, kind, hint: kind === 'list' ? 'Выберите вариант' : kind === 'date' ? 'Дата' : kind === 'int' ? 'Целое число больше 0' : kind === 'number' ? 'Число, дробная часть через запятую' : 'Любой текст', note: '', clearable, options });
  return { groups: [
    { title: '🛍 Товар', fields: [f('item', 'Товар', 'text', [], false), f('variant', 'Цвет / размер', 'text'), f('qty', 'Кол-во', 'int'), f('priceCny', 'Цена за ед. (¥)', 'number'), f('link', 'Ссылка (1688/Taobao)', 'link')] },
    { title: '🚚 Доставка', fields: [f('weight', 'Вес (кг)', 'number'), f('volume', 'Объём (м³)', 'number'), f('method', 'Способ доставки', 'list', ['Авиа', 'Авто', 'ЖД', 'Море']), f('pickup', 'Пункт выдачи карго', 'list', ['Черкесск', 'Москва']), f('shipType', 'Тип отправки', 'list', ['Посылка физлицу', 'Коммерческая партия']), f('track', 'Трек-номер', 'text'), f('hsCode', 'Код ТН ВЭД', 'hs'), f('deliveredDate', 'Факт. дата выдачи', 'date')] },
    { title: '💰 Деньги', fields: [f('priceFact', 'Цена продажи — факт (₽)', 'number'), f('cargoFact', 'Карго — факт (₽)', 'number'), f('localDelivery', 'Доставка по региону (₽)', 'number'), f('cargoCommFact', 'Комиссия от карго — факт (₽)', 'number'), f('paid', 'Получено (₽)', 'number'), f('paidDate', 'Дата оплаты', 'date'), f('scheme', 'Схема оплаты', 'list', ['Предоплата 100%', 'Выкупаем сами, оплата потом', 'Через карго (комиссия от карго)']), f('rateFixed', 'Курс юаня (фикс.)', 'number')] },
    { title: '👤 Прочее', fields: [f('client', 'Клиент', 'client', [], false), f('createdBy', 'Кто внёс', 'list', ['Марат', 'Алим', 'Ислам']), f('comment', 'Комментарий', 'text')] },
  ] };
}

export function demoOrderForm(): OrderFormData {
  return {
    clients: [
      { name: 'Ахмат (Теберда)', city: '', tgConnected: false },
      { name: 'Елена (Москва)', city: 'Москва', tgConnected: true },
      { name: 'Ислам Байрамуков', city: 'Черкесск', tgConnected: false },
      { name: 'Мадина (Черкесск)', city: '', tgConnected: true },
    ],
    pickups: ['Черкесск', 'Москва'],
    shipTypes: ['Посылка физлицу', 'Коммерческая партия'],
    schemes: ['Предоплата 100%', 'Выкупаем сами, оплата потом', 'Через карго (комиссия от карго)'],
    defaultMethod: 'Авто',
    maxItems: 20,
  };
}

// Демо-дашборд — те же демо-заказы, посчитанные «руками» так, как посчитал бы бэкенд.
export function demoDashboard(period: DashboardPeriod): DashboardData {
  const byPeriod = {
    '7d': { days: 7, from: '2026-11-02', newOrders: { total: 5, cancelled: 0 } },
    '30d': { days: 30, from: '2026-10-09', newOrders: { total: 6, cancelled: 1 } },
    'all': { days: 0, from: null, newOrders: { total: 6, cancelled: 1 } },
  }[period];
  return {
    updatedAt: '2026-11-08T09:05',
    cached: false,
    thresholds: { marginWarn: 0.15, staleDays: 14, debtDays: 7 },
    period: { key: period, ...byPeriod, earned: { sum: -350, counted: 1, missingIds: [] } },
    inWork: { total: 4, byStatus: [
      { status: 'Принят', count: 1 }, { status: 'Оплачен', count: 1 }, { status: 'В пути', count: 1 }, { status: 'Проблема', count: 1 },
    ] },
    profit: { sum: 13350, counted: 3, missing: 1, missingIds: ['A-20261107-02'] },
    debts: {
      total: 4800, overdueCount: 0,
      clients: [{ name: 'Елена (Москва)', sum: 4800, since: '2026-11-06', days: 2, overdue: false, ids: ['A-20261106-03'] }],
      cargo: { sum: 3000, ids: ['A-20261105-01'] },
    },
    delivery: {
      avgDays: 4, minDays: 4, maxDays: 4, counted: 1, noDateIds: [], badDateIds: [],
      byMethod: [{ method: 'Авиа', avgDays: 4, count: 1, maxDays: 4, promisedMin: 4, promisedMax: 7 }],
    },
    charts: {
      timeline: DEMO_TIMELINE[period],
      money: {
        client: { orders: 4, expected: 61300, paid: 41500, due: 19800, overpaid: 0 },
        cargo: { orders: 1, expected: 3000, paid: 0, due: 3000, overpaid: 0 },
        notCounted: 1,
      },
    },
    warnings: [
      { key: 'late', level: 'red', title: 'Прошла ожидаемая дата', kind: 'orders', ids: ['A-20261106-03'] },
      { key: 'noWeight', level: 'amber', title: 'Не указан вес', kind: 'orders', ids: ['A-20261107-02', 'A-20261105-01'] },
      { key: 'noLink', level: 'amber', title: 'Нет ссылки на 1688/Taobao', kind: 'orders', ids: ['A-20261107-02', 'A-20261105-01'] },
      { key: 'noScheme', level: 'amber', title: 'Не выбрана схема оплаты', kind: 'orders', ids: ['A-20261107-02'] },
    ],
  };
}

const DEMO_TIMELINE: Record<DashboardPeriod, Timeline> = {
  '7d': { unit: 'day', buckets: [
    { key: '2026-11-02', newOrders: 0, earned: 0 }, { key: '2026-11-03', newOrders: 0, earned: 0 },
    { key: '2026-11-04', newOrders: 0, earned: 0 }, { key: '2026-11-05', newOrders: 1, earned: 0 },
    { key: '2026-11-06', newOrders: 2, earned: -350 }, { key: '2026-11-07', newOrders: 2, earned: 0 },
    { key: '2026-11-08', newOrders: 0, earned: 0 },
  ] },
  '30d': { unit: 'week', buckets: [
    { key: '2026-10-05', newOrders: 0, earned: 0 }, { key: '2026-10-12', newOrders: 0, earned: 0 },
    { key: '2026-10-19', newOrders: 0, earned: 0 }, { key: '2026-10-26', newOrders: 1, earned: 0 },
    { key: '2026-11-02', newOrders: 5, earned: -350 },
  ] },
  'all': { unit: 'month', buckets: [{ key: '2026-10', newOrders: 0, earned: 0 }, { key: '2026-11', newOrders: 6, earned: -350 }] },
};

import type { Order, OrdersList } from './types';

// Демо-данные в том же формате, что отдаёт Api.gs. Нужны, пока API не подключён, и для проверки в браузере.
const STATUSES = ['Принят', 'Оплачен', 'Выкуплен', 'На складе в Китае', 'В пути',
  'На таможне', 'Готов к выдаче', 'Доставлен', 'Проблема', 'Отменён'];

function order(p: Partial<Order> & { id: string; row: number }): Order {
  return {
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

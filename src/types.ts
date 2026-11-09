// Формат ответа API (Api.gs → orders.list). Ключи заказа — как ORDER_COLUMNS в Setup.gs.
// Серые колонки таблицы могут прийти текстом-подсказкой («Укажите вес») вместо числа.
export type Cell = number | string | null;

export interface Order {
  row: number;
  id: string;
  date: string | null;          // «2026-11-07» в поясе таблицы
  createdAt: string | null;
  createdBy: string | null;
  client: string | null;
  tgId: string | null;
  shipType: string | null;
  scheme: string | null;
  item: string | null;
  link: string | null;
  variant: string | null;
  qty: Cell;
  priceCny: Cell;
  weight: Cell;
  method: string | null;
  pickup: string | null;
  priceEst: Cell;
  priceFact: Cell;
  profit: Cell;
  expected: Cell;
  paid: Cell;
  due: Cell;
  status: string | null;
  statusDate: string | null;
  track: string | null;
  eta: string | null;
  deliveredDate: string | null;
  comment: string | null;
  // Готовые признаки от бэкенда
  tgConnected: boolean;
  hasSupplierLink: boolean;
  isFinal: boolean;
  groupId: string;
  [key: string]: unknown;
}

export interface OrdersList {
  orders: Order[];
  statuses: string[];
  finalStatuses: string[];
  lists: Record<string, string[]>;
  serverTime: string;
}

export interface ApiErrorBody {
  code: 'bad_request' | 'unauthorized' | 'expired' | 'forbidden' | 'user_error' | 'internal' | 'network' | 'timeout';
  message: string;
}

// status.preview: что получит клиент. note: send — уйдёт text, noTg — клиент не подключён,
// off — сообщение для статуса отключено в Справочниках, same — этот статус уже стоит.
export interface StatusPreview {
  row: number; id: string; from: string | null; to: string; client: string | null;
  note: 'send' | 'noTg' | 'off' | 'same'; text: string;
}

export interface StatusResult {
  changed: boolean;
  notify: { result: 'sent' | 'noTg' | 'off' | 'dup' | 'fail'; error?: string } | null;
  order: Order;
}

export interface PaymentResult {
  row: number;
  amount: number;
  total: number;
  due: number | null;
  suggestPaid: boolean;  // оплачено полностью, а статус ещё «Принят»
  duplicate: boolean;    // повторный запрос — ничего не прибавлено
  order: Order;
}

// fields.meta: какие поля можно править — те же, что в боте (Edit.gs → EDIT_GROUPS).
export type FieldKind = 'text' | 'int' | 'number' | 'date' | 'link' | 'hs' | 'client' | 'list';
export interface FieldMeta {
  key: string; title: string; kind: FieldKind; hint: string; note: string; clearable: boolean; options: string[];
}
export interface FieldsMeta { groups: { title: string; fields: FieldMeta[] }[] }

export interface FieldSetResult {
  key: string; title: string; old: string; new: string; clientAdded: boolean; warn: string; order: Order;
}

// order.form: клиенты для поиска и списки для кнопок формы нового заказа.
export interface OrderFormData {
  clients: { name: string; city: string; tgConnected: boolean }[];
  pickups: string[];
  shipTypes: string[];
  schemes: string[];
  defaultMethod: string;
  maxItems: number;
}

export interface NewOrderItem { item: string; qty: string; variant: string; link: string; priceCny: string }

export interface NewOrderPayload {
  client: string; city: string; pickup: string; shipType: string; scheme: string; items: NewOrderItem[];
}

export interface NewOrderResult {
  ids: string[]; groupId: string; client: string; clientAdded: boolean; tgConnected: boolean; duplicate: boolean; orders: Order[];
}

// dashboard.get (Dashboard.gs → buildDashboardData в Summary.gs). Всё считает бэкенд — те же цифры, что /summary в боте.
export type DashboardPeriod = '7d' | '30d' | 'all';

export interface DashboardWarning {
  key: string;
  level: 'red' | 'amber';
  title: string;
  kind: 'orders' | 'clients'; // в ids — номера заказов или имена клиентов
  ids: string[];
}

export interface DashboardDebtor {
  name: string; sum: number; since: string | null;
  days: number | null;   // null — товар ещё не выдан, долг ещё не начался
  overdue: boolean;      // дольше «Долг клиента старше» из Настроек
  ids: string[];
}

export interface DashboardData {
  updatedAt: string;
  cached: boolean;
  thresholds: { marginWarn: number; staleDays: number; debtDays: number };
  period: {
    key: DashboardPeriod; days: number; from: string | null;
    newOrders: { total: number; cancelled: number };
    earned: { sum: number; counted: number; missingIds: string[] };
  };
  inWork: { total: number; byStatus: { status: string; count: number }[] };
  profit: { sum: number; counted: number; missing: number; missingIds: string[] };
  debts: { total: number; overdueCount: number; clients: DashboardDebtor[]; cargo: { sum: number; ids: string[] } };
  delivery: {
    avgDays: number | null; minDays: number | null; maxDays: number | null; counted: number;
    byMethod?: DeliveryByMethod[];   // нет у бэкенда до версии с графиками
    noDateIds: string[]; badDateIds: string[];
  };
  charts?: DashboardCharts; // нет у бэкенда до версии с графиками
  warnings: DashboardWarning[];
}

// Переход с дашборда в «Заказы» с готовым фильтром.
export interface OrdersFilter {
  title: string;
  match: (o: Order) => boolean;
}

// Графики дашборда (Summary.gs → timelineData, moneyData, deliveryStats.byMethod).
export type TimelineUnit = 'day' | 'week' | 'month';
export interface Timeline {
  unit: TimelineUnit;
  buckets: { key: string; newOrders: number; earned: number }[]; // key: «2026-11-09» (день, понедельник недели) или «2026-11» (месяц)
}
export interface MoneySide { orders: number; expected: number; paid: number; due: number; overpaid: number }
export interface MoneyChart { client: MoneySide; cargo: MoneySide; notCounted: number }
export interface DeliveryByMethod {
  method: string; avgDays: number; count: number; maxDays: number;
  promisedMin: number | null; promisedMax: number | null; // из Справочников → «Логистика»
}
export interface DashboardCharts { timeline: Timeline; money: MoneyChart }

// order.delete (OrderDelete.gs). duplicate — повтор того же запроса: второй раз не удаляли.
export interface DeleteResult { id: string; row: number; client: string; item: string; duplicate: boolean }

// group.merge / group.split (Grouping.gs). orders — все строки, у которых поменялась «Группа».
export interface GroupResult { changed: boolean; group: string; orders: Order[] }

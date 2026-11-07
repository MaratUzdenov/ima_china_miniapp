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

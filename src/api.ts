import { getInitData, insideTelegram } from './telegram';
import { demoDashboard, demoFieldsMeta, demoOrderForm, demoOrders } from './mock';
import type { ApiErrorBody, DeleteResult, DashboardData, DashboardPeriod, FieldSetResult, FieldsMeta, NewOrderPayload, NewOrderResult, Order, OrderFormData, OrdersList, PaymentResult, StatusPreview, StatusResult } from './types';

const API_URL = (import.meta.env.VITE_API_URL || '').trim();
// Apps Script иногда думает 5–10 секунд (холодный старт). Дольше 30 — считаем, что связи нет.
const REQUEST_TIMEOUT_MS = 30000;

// Демо-режим: адрес API ещё не задан или открыли в обычном браузере (там нет подписи Telegram).
export const demoMode = !API_URL || !insideTelegram;

export class ApiError extends Error {
  code: ApiErrorBody['code'];
  constructor(body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
  }
}

// Сколько занял последний запрос: всего и из них работа скрипта Google. Показываем в итогах действий.
export const lastTiming = { totalMs: 0, serverMs: 0 };

export function timingText(): string {
  if (!lastTiming.totalMs) return '';
  const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');
  return ' · ' + sec(lastTiming.totalMs) + ' с' + (lastTiming.serverMs ? ' (таблица ' + sec(lastTiming.serverMs) + ' с)' : '');
}

async function call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    // text/plain — чтобы браузер не делал предварительный CORS-запрос: Apps Script его не понимает.
    res = await fetch(API_URL + '?api=1', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ method, params, initData: getInitData() }),
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err) {
    const timeout = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError(timeout
      ? { code: 'timeout', message: 'Таблица долго не отвечает. Проверьте интернет (VPN) и нажмите «Повторить».' }
      : { code: 'network', message: 'Нет связи с таблицей. Проверьте интернет (VPN) и нажмите «Повторить».' });
  } finally {
    clearTimeout(timer);
  }
  let json: { ok: boolean; data?: T; error?: ApiErrorBody; serverMs?: number };
  try {
    json = await res.json();
  } catch {
    // Вместо JSON пришла страница Google — чаще всего не сделана «Новая версия» развёртывания.
    throw new ApiError({ code: 'internal', message: 'Таблица ответила не так, как ожидалось. Возможно, не обновлено развёртывание Apps Script.' });
  }
  lastTiming.totalMs = Math.round(performance.now() - started);
  lastTiming.serverMs = typeof json.serverMs === 'number' ? json.serverMs : 0;
  if (!json.ok || json.data === undefined) {
    throw new ApiError(json.error || { code: 'internal', message: 'Неизвестная ошибка.' });
  }
  return json.data;
}

export async function fetchOrders(): Promise<OrdersList> {
  if (demoMode) {
    await new Promise(r => setTimeout(r, 600)); // чтобы в демо было видно скелетон загрузки
    return demoOrders();
  }
  return call<OrdersList>('orders.list');
}

const demoWait = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function previewStatus(o: Order, status: string): Promise<StatusPreview> {
  if (demoMode) {
    await demoWait(400);
    const note = o.status === status ? 'same' : o.tgConnected ? 'send' : 'noTg';
    return { row: o.row, id: o.id, from: o.status, to: status, client: o.client, note,
      text: note === 'send' ? `📦 Заказ ${o.id} — новый статус: «${status}»\nТовар: ${o.item}\n\nЧто дальше: (демо-текст из Справочников)\n\nВопросы — просто напишите сюда.` : '' };
  }
  return call<StatusPreview>('status.preview', { row: o.row, id: o.id, status });
}

// Тексты для всех статусов одним запросом — грузим, пока человек выбирает.
export async function previewAllStatuses(o: Order, statuses: string[]): Promise<StatusPreview[]> {
  if (demoMode) return Promise.all(statuses.map(s => previewStatus(o, s)));
  const r = await call<{ previews: StatusPreview[] }>('status.previewAll', { row: o.row, id: o.id });
  return r.previews;
}

export async function setStatus(o: Order, status: string): Promise<StatusResult> {
  if (demoMode) {
    await demoWait(700);
    return { changed: o.status !== status, notify: { result: o.tgConnected ? 'sent' : 'noTg' },
      order: { ...o, status, statusDate: new Date().toISOString().slice(0, 16) } };
  }
  return call<StatusResult>('status.set', { row: o.row, id: o.id, status });
}

// requestId — один на попытку оплаты: если запрос уйдёт дважды (двойное нажатие, плохая связь),
// бэкенд запишет деньги один раз.
export async function addPayment(o: Order, amount: number, requestId: string): Promise<PaymentResult> {
  if (demoMode) {
    await demoWait(700);
    const paid = (typeof o.paid === 'number' ? o.paid : 0) + amount;
    const expected = typeof o.expected === 'number' ? o.expected : null;
    const due = expected === null ? null : expected - paid;
    return { row: o.row, amount, total: paid, due, duplicate: false,
      suggestPaid: due !== null && due <= 0 && o.status === 'Принят',
      order: { ...o, paid, due, paidDate: new Date().toISOString().slice(0, 10) } };
  }
  return call<PaymentResult>('payment.add', { row: o.row, id: o.id, amount, requestId });
}

export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
}

// Список полей меняется редко — грузим один раз за сеанс.
let fieldsMetaPromise: Promise<FieldsMeta> | null = null;
export function fetchFieldsMeta(): Promise<FieldsMeta> {
  if (!fieldsMetaPromise) {
    fieldsMetaPromise = (demoMode ? demoWait(300).then(demoFieldsMeta) : call<FieldsMeta>('fields.meta'));
    fieldsMetaPromise.catch(() => { fieldsMetaPromise = null; }); // ошибка — в следующий раз попробуем снова
  }
  return fieldsMetaPromise;
}

// value — текст как ввёл человек (проверяет бэкенд, как в боте); clear — очистить поле.
export async function setField(o: Order, key: string, value: string, clear = false): Promise<FieldSetResult> {
  if (demoMode) {
    await demoWait(500);
    if (!clear && !value.trim()) throw new ApiError({ code: 'user_error', message: 'Пустое значение. Чтобы очистить поле — нажмите «Очистить».' });
    const num = Number(value.replace(/\s/g, '').replace(',', '.'));
    const v = clear ? null : (value.trim() !== '' && !isNaN(num) && /^[\d\s.,]+$/.test(value) ? num : value.trim());
    return { key, title: key, old: String(o[key] ?? ''), new: clear ? '' : value, clientAdded: false, warn: '', order: { ...o, [key]: v } };
  }
  return call<FieldSetResult>('field.set', clear ? { row: o.row, id: o.id, key, clear: true } : { row: o.row, id: o.id, key, value });
}

export async function fetchOrderForm(): Promise<OrderFormData> {
  if (demoMode) { await demoWait(400); return demoOrderForm(); }
  return call<OrderFormData>('order.form');
}

// requestId — один на попытку: повторная отправка той же формы не создаст заказ дважды.
export async function createOrder(payload: NewOrderPayload, requestId: string): Promise<NewOrderResult> {
  if (demoMode) {
    await demoWait(900);
    const ids = payload.items.map((_, i) => 'A-DEMO-0' + (i + 1));
    return { ids, groupId: ids[0], client: payload.city ? `${payload.client} (${payload.city})` : payload.client, clientAdded: true, tgConnected: false, duplicate: false, orders: [] };
  }
  return call<NewOrderResult>('order.create', { ...payload, requestId });
}

// Дашборд. Бэкенд помнит ответ 90 секунд; refresh — посчитать заново (после своей правки или по кнопке «Обновить»).
export async function fetchDashboard(period: DashboardPeriod, refresh = false): Promise<DashboardData> {
  if (demoMode) { await demoWait(600); return demoDashboard(period); }
  return call<DashboardData>('dashboard.get', { period, refresh });
}

// Отметка «в заказах что-то поменяли» — дашборд при следующем открытии попросит свежие цифры, а не из памяти.
let dashboardStale = false;
export function markDashboardStale(): void { dashboardStale = true; }
export function takeDashboardStale(): boolean {
  const v = dashboardStale;
  dashboardStale = false;
  return v;
}

// Удаление заказа. requestId — один на попытку: повторная отправка не удалит соседнюю строку
// и не выдаст «не найден» — бэкенд вернёт прошлый результат.
export async function deleteOrder(o: Order, requestId: string): Promise<DeleteResult> {
  if (demoMode) { await demoWait(800); return { id: o.id, row: o.row, client: o.client || '', item: o.item || '', duplicate: false }; }
  return call<DeleteResult>('order.delete', { row: o.row, id: o.id, requestId });
}

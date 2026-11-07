import { getInitData, insideTelegram } from './telegram';
import { demoOrders } from './mock';
import type { ApiErrorBody, Order, OrdersList, PaymentResult, StatusPreview, StatusResult } from './types';

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

async function call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
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
  let json: { ok: boolean; data?: T; error?: ApiErrorBody };
  try {
    json = await res.json();
  } catch {
    // Вместо JSON пришла страница Google — чаще всего не сделана «Новая версия» развёртывания.
    throw new ApiError({ code: 'internal', message: 'Таблица ответила не так, как ожидалось. Возможно, не обновлено развёртывание Apps Script.' });
  }
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

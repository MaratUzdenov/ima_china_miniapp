import { getInitData, insideTelegram } from './telegram';
import { demoOrders } from './mock';
import type { ApiErrorBody, OrdersList } from './types';

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

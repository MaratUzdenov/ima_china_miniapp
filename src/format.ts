import type { Cell, Order } from './types';

const rubFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export const isNum = (v: Cell | unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const rub = (v: number) => rubFmt.format(v) + ' ₽';

// «2026-11-07» → «7 нояб.» (без сдвига пояса: дату разбираем как местную, а не UTC).
export function shortDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function todayIso(): string {
  const t = new Date();
  return [t.getFullYear(), String(t.getMonth() + 1).padStart(2, '0'), String(t.getDate()).padStart(2, '0')].join('-');
}

// Поиск без учёта регистра и ё/е — как в боте.
export const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export interface Warning { text: string; level: 'red' | 'amber' }

// То же, на что смотрит «Сводка» бота, но коротко — значками на карточке.
export function orderWarnings(o: Order, today: string): Warning[] {
  const w: Warning[] = [];
  if (isNum(o.profit) && o.profit < 0) w.push({ text: 'убыток', level: 'red' });
  if (!o.isFinal && o.eta && o.eta < today) w.push({ text: 'просрочен', level: 'red' });
  if (o.isFinal) return w;
  if (!isNum(o.weight) || o.weight <= 0) w.push({ text: 'нет веса', level: 'amber' });
  // Вес есть, а карго не посчитано — нет тарифа у способа доставки (как «Карго не посчитано» в /summary).
  else if (!isNum(o.cargoFact) && !isNum(o.cargoEst)) w.push({ text: 'нет тарифа карго', level: 'red' });
  if (!o.hasSupplierLink) w.push({ text: 'нет ссылки', level: 'amber' });
  if (!o.scheme) w.push({ text: 'нет схемы оплаты', level: 'amber' });
  if (!o.tgConnected) w.push({ text: 'клиент без Telegram', level: 'amber' });
  return w;
}

// 1 товар, 2 товара, 5 товаров
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const num2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const num4 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 });

// «2026-11-07T11:49» → «7 нояб., 11:49»
export function shortDateTime(iso: string | null): string {
  if (!iso) return '';
  const time = iso.slice(11, 16);
  return shortDate(iso) + (time ? ', ' + time : '');
}

// Значение поля для показа. Текст из серых колонок («Укажите вес») возвращаем как подсказку.
export function formatField(v: unknown, fmt: string | undefined): { text: string; isHint: boolean } {
  if (v === null || v === undefined || v === '') return { text: '—', isHint: true };
  if (typeof v === 'string' && fmt && !['text', 'link', 'date', 'datetime'].includes(fmt)) return { text: v, isHint: true };
  if (typeof v === 'number') {
    switch (fmt) {
      case 'money': return { text: rub(v), isHint: false };
      case 'cny': return { text: num2.format(v) + ' ¥', isHint: false };
      case 'kg': return { text: num2.format(v) + ' кг', isHint: false };
      case 'm3': return { text: num4.format(v) + ' м³', isHint: false };
      case 'pct': return { text: (v * 100).toFixed(1).replace('.', ',') + '%', isHint: false };
      case 'rate': return { text: num4.format(v) + ' ₽', isHint: false };
      default: return { text: num2.format(v), isHint: false };
    }
  }
  if (fmt === 'date') return { text: shortDate(String(v)), isHint: false };
  if (fmt === 'datetime') return { text: shortDateTime(String(v)), isHint: false };
  return { text: String(v), isHint: false };
}

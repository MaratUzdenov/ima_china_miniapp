import type { TimelineUnit } from './types';

// Подписи для графиков. Даты-ключи от бэкенда («2026-11-09», «2026-11») — просто календарь, без поясов.

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_NOM = ['янв', 'фев', 'март', 'апр', 'май', 'июнь', 'июль', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const parts = (key: string) => key.split('-').map(Number);
const dateOf = (key: string) => { const [y, m, d] = parts(key); return new Date(Date.UTC(y, m - 1, d || 1)); };

// Короткая подпись под столбцом: «пн 3», «3 ноя», «ноя».
export function bucketTick(key: string, unit: TimelineUnit): string {
  const d = dateOf(key);
  if (unit === 'day') return WEEKDAYS[d.getUTCDay()] + ' ' + d.getUTCDate();
  if (unit === 'week') return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  return MONTHS_NOM[d.getUTCMonth()];
}

// Полная подпись в подсказке: «пн, 3 ноя», «3–9 ноя», «ноябрь 2026».
export function bucketTitle(key: string, unit: TimelineUnit): string {
  const d = dateOf(key);
  if (unit === 'day') return WEEKDAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  if (unit === 'week') {
    const end = new Date(d.getTime() + 6 * 86400000);
    return d.getUTCDate() + (d.getUTCMonth() === end.getUTCMonth() ? '' : ' ' + MONTHS[d.getUTCMonth()]) +
      '–' + end.getUTCDate() + ' ' + MONTHS[end.getUTCMonth()];
  }
  return MONTHS_NOM[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// 125000 → «125 тыс.» — для оси, чтобы цифры не налезали.
export function compactRub(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return (v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн';
  if (a >= 1000) return Math.round(v / 1000).toLocaleString('ru-RU') + ' тыс.';
  return String(Math.round(v));
}

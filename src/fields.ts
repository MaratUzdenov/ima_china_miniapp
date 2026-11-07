import type { Order } from './types';

// Как показывать поля заказа. Названия — как заголовки колонок в «Заказах» (Setup.gs → ORDER_COLUMNS),
// группы — как в боте (Edit.gs → EDIT_GROUPS) плюс расчётные поля, которые в боте не редактируются.
export type FieldFormat = 'text' | 'money' | 'cny' | 'kg' | 'm3' | 'pct' | 'rate' | 'int' | 'date' | 'datetime' | 'link';

export interface FieldDef { key: keyof Order & string; title: string; fmt?: FieldFormat; hint?: string }
export interface FieldGroup { title: string; fields: FieldDef[] }

export const DETAIL_GROUPS: FieldGroup[] = [
  { title: '🛍 Товар', fields: [
    { key: 'item', title: 'Товар' },
    { key: 'variant', title: 'Цвет / размер' },
    { key: 'qty', title: 'Кол-во', fmt: 'int' },
    { key: 'priceCny', title: 'Цена за ед.', fmt: 'cny' },
    { key: 'sumCny', title: 'Сумма', fmt: 'cny' },
    { key: 'rate', title: 'Курс в расчёте', fmt: 'rate' },
    { key: 'sumRub', title: 'Сумма товара', fmt: 'money' },
    { key: 'link', title: 'Ссылка', fmt: 'link' },
  ] },
  { title: '🚚 Доставка', fields: [
    { key: 'shipType', title: 'Тип отправки' },
    { key: 'method', title: 'Способ доставки' },
    { key: 'pickup', title: 'Пункт выдачи' },
    { key: 'weight', title: 'Вес', fmt: 'kg', hint: 'Без веса оценка карго не считается.' },
    { key: 'volume', title: 'Объём', fmt: 'm3' },
    { key: 'track', title: 'Трек-номер' },
    { key: 'eta', title: 'Ожидаемая дата', fmt: 'date' },
    { key: 'deliveredDate', title: 'Факт. дата выдачи', fmt: 'date' },
    { key: 'hsCode', title: 'Код ТН ВЭД', hint: 'Только для коммерческих партий. Не угадывайте — уточните у брокера.' },
  ] },
  { title: '💰 Деньги', fields: [
    { key: 'scheme', title: 'Схема оплаты' },
    { key: 'cargoEst', title: 'Карго — примерно', fmt: 'money' },
    { key: 'cargoFact', title: 'Карго — факт', fmt: 'money' },
    { key: 'localDelivery', title: 'Доставка по региону', fmt: 'money' },
    { key: 'cost', title: 'Себестоимость', fmt: 'money' },
    { key: 'priceEst', title: 'Цена продажи — примерно', fmt: 'money' },
    { key: 'priceFact', title: 'Цена продажи — факт', fmt: 'money' },
    { key: 'profit', title: 'Прибыль', fmt: 'money' },
    { key: 'margin', title: 'Маржа', fmt: 'pct' },
    { key: 'expected', title: 'Ожидаем получить', fmt: 'money' },
    { key: 'paid', title: 'Получено', fmt: 'money' },
    { key: 'paidDate', title: 'Дата оплаты', fmt: 'date' },
    { key: 'due', title: 'Осталось получить', fmt: 'money' },
  ] },
  { title: '🧾 Таможня (справочно)', fields: [
    { key: 'duty', title: 'Пошлина', fmt: 'money', hint: 'Для посылок до 200 € и 31 кг пошлина обычно не начисляется. Для партий — по коду ТН ВЭД. Ставки проверяйте у брокера.' },
    { key: 'vat', title: 'НДС', fmt: 'money' },
    { key: 'fee', title: 'Таможенный сбор', fmt: 'money', hint: 'Берётся за декларацию, а не за каждый товар.' },
  ] },
  { title: '👤 Прочее', fields: [
    { key: 'date', title: 'Дата заказа', fmt: 'date' },
    { key: 'createdBy', title: 'Кто внёс' },
    { key: 'statusDate', title: 'Статус сменён', fmt: 'datetime' },
    { key: 'basis', title: 'Расчёт по' },
    { key: 'comment', title: 'Комментарий' },
  ] },
];

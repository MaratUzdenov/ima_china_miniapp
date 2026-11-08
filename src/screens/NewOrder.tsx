import { useEffect, useMemo, useState } from 'react';
import { ApiError, createOrder, demoMode, fetchOrderForm, newRequestId, timingText } from '../api';
import { SkeletonList } from '../components/States';
import { norm, plural } from '../format';
import { notifySuccess, useTelegramBack } from '../telegram';
import type { NewOrderItem, NewOrderResult, OrderFormData } from '../types';

interface Props {
  onClose: () => void;
  onCreated: () => void; // перезагрузить список заказов
}

const emptyItem = (): NewOrderItem => ({ item: '', qty: '', variant: '', link: '', priceCny: '' });
const SUGGEST_MAX = 6;

// Как в боте (buildClientName): только имя → «Имя (Город)»; с фамилией или скобками — как написали.
export function buildClientName(name: string, city: string): string {
  const cap = (s: string) => s.replace(/(^|\s|\()(\S)/g, (_m, a: string, b: string) => a + b.toUpperCase());
  const n = name.replace(/\s+/g, ' ').trim();
  const c = city.replace(/\s+/g, ' ').trim();
  if (/\(.+\)/.test(n) || n.split(' ').length >= 2 || !c) return cap(n);
  return cap(n) + ' (' + cap(c) + ')';
}

// Те же правила, что parseFieldValue в боте; окончательная проверка — на бэкенде.
function itemProblem(it: NewOrderItem, n: number): string {
  const where = 'Товар ' + n + ': ';
  if (!it.item.trim()) return where + 'напишите название.';
  const qty = it.qty.replace(/[\s ]/g, '');
  if (qty && !(/^\d+$/.test(qty) && Number(qty) > 0)) return where + 'кол-во — целое число больше 0.';
  const price = it.priceCny.replace(/[\s ]/g, '');
  if (price && !/^\d+([.,]\d+)?$/.test(price)) return where + 'цена — число, например 35,5.';
  if (it.link.trim() && !/^https?:\/\/\S+$/i.test(it.link.trim())) return where + 'ссылка должна начинаться с https://.';
  return '';
}

// Новый заказ: клиент и условия один раз + несколько товаров. Каждый товар — своя строка «Заказов», одна группа.
export function NewOrder({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<OrderFormData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [picked, setPicked] = useState(false); // клиента выбрали из списка — имя точное
  const [pickup, setPickup] = useState('');
  const [shipType, setShipType] = useState('');
  const [scheme, setScheme] = useState('');
  const [items, setItems] = useState<NewOrderItem[]>([emptyItem()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<NewOrderResult | null>(null);
  const [leaveWarned, setLeaveWarned] = useState(false);
  const requestId = useMemo(() => newRequestId(), []);

  const load = () => {
    setLoadError('');
    fetchOrderForm().then(setForm).catch(err => setLoadError(err instanceof ApiError ? err.message : 'Не получилось загрузить. Проверьте интернет.'));
  };
  useEffect(load, []);

  const dirty = !!(name || items.some(i => i.item || i.qty || i.link));
  // Любая правка формы убирает старую ошибку — она уже может быть неактуальной.
  useEffect(() => { setError(''); setLeaveWarned(false); }, [name, city, pickup, shipType, scheme, items]);
  // «Назад» с заполненной формой — сначала предупреждаем, чтобы случайно не потерять набранное.
  useEffect(() => {
    if (saving) return useTelegramBack(null);
    return useTelegramBack(() => {
      if (result || !dirty || leaveWarned) { if (result) onCreated(); onClose(); return; }
      setLeaveWarned(true);
      setError('Форма не сохранена. Нажмите «Назад» ещё раз, чтобы выйти без записи.');
    });
  }, [saving, dirty, leaveWarned, result, onClose, onCreated]);

  const suggestions = useMemo(() => {
    if (!form || picked || name.trim().length < 2) return [];
    const q = norm(name);
    return form.clients.filter(c => norm(c.name).includes(q)).slice(0, SUGGEST_MAX);
  }, [form, name, picked]);

  const known = form?.clients.find(c => norm(c.name) === norm(picked ? name : buildClientName(name, city)));
  const finalName = name.trim() ? (picked ? name : buildClientName(name, city)) : '';

  const pickClient = (c: OrderFormData['clients'][number]) => {
    setName(c.name);
    setPicked(true);
    const cityFromName = c.name.match(/\(([^)]+)\)\s*$/)?.[1] || c.city;
    setCity(cityFromName || '');
    if (form && !pickup) {
      const match = form.pickups.find(p => norm(p) === norm(cityFromName || ''));
      if (match) setPickup(match);
    }
  };

  const setItem = (i: number, patch: Partial<NewOrderItem>) => setItems(list => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const submit = () => {
    if (!form) return;
    setLeaveWarned(false);
    const problems = [
      !finalName && 'Укажите клиента.',
      /\d/.test(name) && 'В имени клиента не должно быть цифр.',
      !pickup && 'Выберите пункт выдачи.',
      !shipType && 'Выберите тип отправки.',
      !scheme && 'Выберите схему оплаты.',
      ...items.map((it, i) => itemProblem(it, i + 1)),
    ].filter(Boolean) as string[];
    if (problems.length) { setError(problems[0]); return; }
    setError('');
    setSaving(true);
    createOrder({ client: picked ? name : name.trim(), city: picked ? '' : city.trim(), pickup, shipType, scheme, items }, requestId)
      .then(r => { notifySuccess(); setResult(r); window.scrollTo(0, 0); })
      .catch(err => setError(err instanceof ApiError ? err.message : 'Не получилось записать. Проверьте интернет и нажмите ещё раз — дважды заказ не запишется.'))
      .finally(() => setSaving(false));
  };

  if (result) {
    return (
      <div className="screen screen--details">
        <section className="card">
          <div className="details__title">✅ Заказ записан</div>
          <div className="details__client">{result.client} · {result.ids.length} {plural(result.ids.length, 'товар', 'товара', 'товаров')}</div>
          <div className="notice">{result.duplicate ? 'ℹ️ Этот заказ уже был записан — второй раз не записывал. ' : ''}ID: {result.ids.join(', ')}{timingText()}</div>
          {result.clientAdded && <div className="details__note">🆕 Новый клиент добавлен на лист «Клиенты».</div>}
          {!result.tgConnected && <div className="details__note">⚠️ Клиент не подключён к боту — статусы не получит. Ссылка для него — в боте: «🔗 Ссылка клиенту».</div>}
          <div className="details__note">Двум другим админам ушло уведомление. Вес, способ доставки и цену можно дописать в карточке заказа → «✏️ Редактировать».</div>
          <div className="actions">
            <button className="button" onClick={() => { onCreated(); onClose(); }}>К заказам</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="details__title">➕ Новый заказ</div>
        <div className="details__note">
          Каждый товар станет отдельной строкой в «Заказах», все — одним заказом клиента.
          {form?.defaultMethod ? ` Способ доставки — «${form.defaultMethod}» (по умолчанию, можно поменять потом).` : ''} Вес — потом, в «Редактировать».
        </div>
      </section>

      {loadError && (
        <section className="card">
          <div className="details__note">{loadError}</div>
          <div className="actions"><button className="button" onClick={load}>Повторить</button></div>
        </section>
      )}
      {!form && !loadError && <SkeletonList />}

      {form && (
        <>
          <section className="card">
            <h2 className="section__title">👤 Клиент</h2>
            <input className="search" placeholder="Имя или «Имя Фамилия»" value={name} disabled={saving} autoComplete="off"
              onChange={e => { setName(e.target.value); setPicked(false); }} />
            {suggestions.length > 0 && (
              <div className="options">
                {suggestions.map(c => (
                  <button key={c.name} className="option" onClick={() => pickClient(c)}>
                    {c.name}{c.tgConnected ? ' · Telegram ✅' : ''}
                  </button>
                ))}
              </div>
            )}
            {!picked && (
              <input className="search field-gap" placeholder="Город (для нового клиента)" value={city} disabled={saving} autoComplete="off"
                onChange={e => setCity(e.target.value)} />
            )}
            {finalName && (
              <div className="details__note">
                {known ? `✅ Есть в базе: ${known.name}${known.tgConnected ? ' · Telegram ✅' : ''}` : `🆕 Новый клиент: «${finalName}»`}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="section__title">📍 Пункт выдачи</h2>
            <Choice options={form.pickups} value={pickup} onChange={setPickup} disabled={saving} />
            <h2 className="section__title field-gap">🚚 Тип отправки</h2>
            <Choice options={form.shipTypes} value={shipType} onChange={setShipType} disabled={saving} />
            <h2 className="section__title field-gap">💰 Схема оплаты</h2>
            <Choice options={form.schemes} value={scheme} onChange={setScheme} disabled={saving} />
          </section>

          {items.map((it, i) => (
            <section key={i} className="card">
              <div className="card__head">
                <h2 className="section__title">🛍 Товар {i + 1}</h2>
                {items.length > 1 && (
                  <button className="link" disabled={saving} onClick={() => setItems(list => list.filter((_, j) => j !== i))}>Убрать</button>
                )}
              </div>
              <input className="search" placeholder="Название, например «Кроссовки белые»" value={it.item} disabled={saving}
                onChange={e => setItem(i, { item: e.target.value })} />
              <div className="row2 field-gap">
                <input className="search" placeholder="Кол-во" inputMode="numeric" value={it.qty} disabled={saving}
                  onChange={e => setItem(i, { qty: e.target.value })} />
                <input className="search" placeholder="Цена за ед., ¥" inputMode="decimal" value={it.priceCny} disabled={saving}
                  onChange={e => setItem(i, { priceCny: e.target.value })} />
              </div>
              <input className="search field-gap" placeholder="Цвет / размер" value={it.variant} disabled={saving}
                onChange={e => setItem(i, { variant: e.target.value })} />
              <input className="search field-gap" placeholder="Ссылка 1688 / Taobao (если есть)" inputMode="url" value={it.link} disabled={saving}
                onChange={e => setItem(i, { link: e.target.value })} />
            </section>
          ))}

          {items.length < form.maxItems && (
            <button className="button button--secondary" disabled={saving} onClick={() => setItems(list => [...list, emptyItem()])}>➕ Ещё товар</button>
          )}

          {error && <div className="notice notice--error">{error}</div>}
          {demoMode && <div className="details__note details__note--center">Демо-режим: в таблицу ничего не запишется.</div>}
          <button className="button" disabled={saving} onClick={submit}>
            {saving ? 'Записываю…' : `Записать ${items.length} ${plural(items.length, 'товар', 'товара', 'товаров')}`}
          </button>
        </>
      )}
    </div>
  );
}

function Choice({ options, value, onChange, disabled }: { options: string[]; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="choices">
      {options.map(o => (
        <button key={o} className={'choice' + (o === value ? ' choice--on' : '')} disabled={disabled} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

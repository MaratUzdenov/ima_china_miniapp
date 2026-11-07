import { useEffect, useMemo, useState } from 'react';
import { addPayment, ApiError, demoMode, newRequestId } from '../api';
import { isNum, rub } from '../format';
import { notifySuccess, useTelegramBack } from '../telegram';
import type { Order, PaymentResult } from '../types';

interface Props {
  order: Order;
  onDone: (r: PaymentResult) => void;
  onCancel: () => void;
}

// «3 500», «2500,50», «1500.75» → число; иначе null. Та же проверка, что в боте (parseMoneyNumber).
export function parseAmount(text: string): number | null {
  const s = text.replace(/[\s ]/g, '').replace(/₽|руб\.?|р\.?$/gi, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return n > 0 && isFinite(n) ? n : null;
}

// Внести оплату: сумма прибавляется к «Получено», «Дата оплаты» — сегодня, строка — в комментарий.
export function Payment({ order: o, onDone, onCancel }: Props) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Один номер на попытку: повторная отправка той же оплаты не прибавит её второй раз.
  const requestId = useMemo(() => newRequestId(), []);

  useEffect(() => useTelegramBack(saving ? null : onCancel), [saving, onCancel]);

  const amount = parseAmount(text);
  const due = isNum(o.due) ? o.due : null;
  const cargoPays = o.payer === 'Карго';

  const save = () => {
    if (amount === null) return;
    setSaving(true);
    setError('');
    addPayment(o, amount, requestId)
      .then(r => { notifySuccess(); onDone(r); })
      .catch(err => {
        setSaving(false);
        setError(err instanceof ApiError ? err.message : 'Не получилось записать. Проверьте интернет и нажмите ещё раз — дважды деньги не запишутся.');
      });
  };

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">💰 Внести оплату</div>
        <div className="details__client">{o.item} · {o.client}</div>
        <div className="money">
          <div><span>Ожидаем</span><b>{isNum(o.expected) ? rub(o.expected) : '—'}</b></div>
          <div><span>Получено</span><b>{isNum(o.paid) ? rub(o.paid) : rub(0)}</b></div>
          <div><span>Осталось</span><b>{due !== null ? rub(due) : '—'}</b></div>
        </div>
        {!isNum(o.expected) && typeof o.expected === 'string' && <div className="details__note">⚠️ {o.expected}</div>}
        {cargoPays && <div className="details__note">Схема «через карго»: вносите сюда комиссию, которую заплатило карго.</div>}
      </section>

      <section className="card">
        <label className="section__title" htmlFor="amount">Сколько пришло, ₽</label>
        <input
          id="amount"
          className="search amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Например, 5000"
          value={text}
          disabled={saving}
          onChange={e => setText(e.target.value)}
        />
        {text && amount === null && <div className="field__hint">Нужна сумма числом больше 0, например 5000 или 2500,50.</div>}
        {due !== null && due > 0 && (
          <button className="chip chip--action" disabled={saving} onClick={() => setText(String(due))}>Весь остаток: {rub(due)}</button>
        )}
        {amount !== null && due !== null && amount > due && due >= 0 && (
          <div className="details__note">⚠️ Это больше остатка — получится переплата {rub(amount - due)}.</div>
        )}
        {demoMode && <div className="details__note">Демо-режим: в таблицу ничего не запишется.</div>}
        {error && <div className="notice notice--error">{error}</div>}
        <div className="actions">
          <button className="button" disabled={amount === null || saving} onClick={save}>
            {saving ? 'Записываю…' : amount !== null ? `Записать ${rub(amount)}` : 'Записать'}
          </button>
        </div>
        <div className="details__note">Сумма прибавится к «Получено», дата оплаты станет сегодняшней, в комментарий запишется «оплата … (ваше имя)».</div>
      </section>
    </div>
  );
}

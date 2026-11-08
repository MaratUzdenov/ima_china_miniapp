import { useCallback, useEffect, useState } from 'react';
import { StatusProgress } from '../components/StatusProgress';
import { HelpTip } from '../components/HelpTip';
import { DETAIL_GROUPS } from '../fields';
import { formatField, isNum, orderWarnings, rub, todayIso } from '../format';
import { insideTelegram, openExternal, useTelegramBack } from '../telegram';
import { timingText } from '../api';
import type { Order, PaymentResult, StatusResult } from '../types';
import { Payment } from './Payment';
import { EditOrder } from './EditOrder';
import { StatusChange } from './StatusChange';

interface Props {
  order: Order;
  chain: string[];
  statuses: string[];
  onBack: () => void;
  onOrderUpdated: (o: Order) => void;
}

// Итог оплаты — как в боте (Edit.gs → applyPaymentText).
function paymentText(r: PaymentResult): string {
  if (r.duplicate) return 'ℹ️ Эта оплата уже была записана — второй раз не прибавлял.';
  let t = '✅ Оплата ' + rub(r.amount) + ' записана. Получено всего: ' + rub(r.total) + '.';
  if (r.due !== null) {
    if (r.due > 0) t += ' Осталось: ' + rub(r.due) + '.';
    else if (r.due === 0) t += ' 🎉 Оплачено полностью.';
    else t += ' 🔵 Переплата: ' + rub(-r.due) + ' — нужно вернуть или зачесть.';
  }
  if (r.suggestPaid) t += ' Заказ ещё «Принят» — можно поставить «Оплачен» (клиент получит сообщение).';
  return t;
}

// Итог смены статуса — те же формулировки, что в боте (Status.gs → clientResultText).
function resultText(r: StatusResult): string {
  if (!r.changed) return 'ℹ️ Этот статус уже стоял — ничего не менял.';
  const head = '✅ Статус «' + (r.order.status || '') + '» сохранён. ';
  switch (r.notify?.result) {
    case 'sent': return head + '📨 Клиенту отправлено сообщение.';
    case 'noTg': return head + '⚠️ Клиенту не отправлено: он не подключён к боту.';
    case 'off': return head + 'ℹ️ Для этого статуса сообщение клиенту отключено.';
    case 'dup': return head + 'ℹ️ Клиент уже получал сообщение об этом статусе.';
    case 'fail': return head + '❌ Клиенту не отправлено: ' + (r.notify.error || 'ошибка Telegram') + '. Подробности — лист «Лог».';
    default: return head;
  }
}

// Карточка заказа: все поля по группам, как в боте. Пока только просмотр —
// смена статуса и оплата появятся, когда API научится писать в таблицу.
export function OrderDetails({ order: o, chain, statuses, onBack, onOrderUpdated }: Props) {
  const [mode, setMode] = useState<'view' | 'status' | 'payment' | 'edit'>('view');
  const changingStatus = mode !== 'view';
  const setChangingStatus = (on: boolean) => setMode(on ? 'status' : 'view');
  const [notice, setNotice] = useState('');
  const closeStatus = useCallback(() => setMode('view'), []);
  const statusDone = useCallback((r: StatusResult) => {
    onOrderUpdated(r.order);
    setNotice(resultText(r) + timingText());
    setMode('view');
  }, [onOrderUpdated]);
  const paymentDone = useCallback((r: PaymentResult) => {
    onOrderUpdated(r.order);
    setNotice(paymentText(r) + timingText());
    setMode('view');
  }, [onOrderUpdated]);

  useEffect(() => (changingStatus ? undefined : useTelegramBack(onBack)), [onBack, changingStatus]);
  useEffect(() => { window.scrollTo(0, 0); }, [o.id, changingStatus]);

  if (mode === 'status') {
    return <StatusChange order={o} statuses={statuses} onDone={statusDone} onCancel={closeStatus} />;
  }
  if (mode === 'payment') {
    return <Payment order={o} onDone={paymentDone} onCancel={closeStatus} />;
  }
  if (mode === 'edit') {
    return <EditOrder order={o} onOrderUpdated={onOrderUpdated} onClose={closeStatus} />;
  }
  const warnings = orderWarnings(o, todayIso());

  return (
    <div className="screen screen--details">
      {/* В Telegram «Назад» — системная кнопка в шапке; в обычном браузере её нет — показываем свою */}
      {!insideTelegram && <button className="button button--ghost back" onClick={onBack}>‹ К списку</button>}
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">
          {o.item || 'Товар не указан'}
          {isNum(o.qty) && <span className="item__qty"> × {o.qty}</span>}
        </div>
        <div className="details__client">
          {o.client || 'Клиент не указан'} · {o.tgConnected ? 'Telegram ✅' : 'Telegram ❌'}
        </div>
        <StatusProgress status={o.status} chain={chain} />
        {warnings.length > 0 && (
          <div className="chips">
            {warnings.map(w => <span key={w.text} className={'chip chip--' + w.level}>{w.text}</span>)}
          </div>
        )}
        {isNum(o.due) && o.due > 0 && <div className="card__debt">Осталось получить: <b>{rub(o.due)}</b></div>}
        <div className="actions">
          <button className="button" onClick={() => { setNotice(''); setChangingStatus(true); }}>🔄 Сменить статус</button>
          <button className="button button--secondary" onClick={() => { setNotice(''); setMode('payment'); }}>💰 Внести оплату</button>
          <button className="button button--secondary" onClick={() => { setNotice(''); setMode('edit'); }}>✏️ Редактировать</button>
        </div>
        {notice && <div className="notice">{notice}</div>}
        {!o.tgConnected && (
          <div className="details__note">Клиент не получит сообщение о статусе. Ссылка для подключения — в боте: «🔗 Ссылка клиенту».</div>
        )}
      </section>

      {DETAIL_GROUPS.map(g => (
        <section key={g.title} className="card">
          <h2 className="section__title">{g.title}</h2>
          <dl className="fields">
            {g.fields.map(f => <FieldRow key={f.key} title={f.title} value={o[f.key]} fmt={f.fmt} hint={f.hint} />)}
          </dl>
        </section>
      ))}

    </div>
  );
}

function FieldRow({ title, value, fmt, hint }: { title: string; value: unknown; fmt?: string; hint?: string }) {
  const shown = formatField(value, fmt);
  const isLink = fmt === 'link' && typeof value === 'string' && /^https?:\/\//i.test(value);
  return (
    <div className="field">
      <dt className="field__title">
        {title}
        {hint && <HelpTip text={hint} label={title} />}
      </dt>
      <dd className={'field__value' + (shown.isHint ? ' field__value--hint' : '')}>
        {isLink ? <button className="link" onClick={() => openExternal(value as string)}>Открыть ↗</button> : shown.text}
      </dd>
    </div>
  );
}

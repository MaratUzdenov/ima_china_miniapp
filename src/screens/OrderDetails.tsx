import { useEffect, useState } from 'react';
import { StatusProgress } from '../components/StatusProgress';
import { DETAIL_GROUPS } from '../fields';
import { formatField, isNum, orderWarnings, rub, todayIso } from '../format';
import { insideTelegram, openExternal, useTelegramBack } from '../telegram';
import type { Order } from '../types';

interface Props {
  order: Order;
  chain: string[];
  onBack: () => void;
}

// Карточка заказа: все поля по группам, как в боте. Пока только просмотр —
// смена статуса и оплата появятся, когда API научится писать в таблицу.
export function OrderDetails({ order: o, chain, onBack }: Props) {
  useEffect(() => useTelegramBack(onBack), [onBack]);
  useEffect(() => { window.scrollTo(0, 0); }, [o.id]);
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

      <div className="details__note details__note--center">
        Изменить заказ пока можно в боте: «📋 Заказы» → заказ → ✏️ Редактировать.
      </div>
    </div>
  );
}

function FieldRow({ title, value, fmt, hint }: { title: string; value: unknown; fmt?: string; hint?: string }) {
  const [showHint, setShowHint] = useState(false);
  const shown = formatField(value, fmt);
  const isLink = fmt === 'link' && typeof value === 'string' && /^https?:\/\//i.test(value);
  return (
    <div className="field">
      <dt className="field__title">
        {title}
        {hint && (
          <button className="field__help" aria-label={'Подсказка: ' + title} onClick={() => setShowHint(v => !v)}>?</button>
        )}
      </dt>
      <dd className={'field__value' + (shown.isHint ? ' field__value--hint' : '')}>
        {isLink ? <button className="link" onClick={() => openExternal(value as string)}>Открыть ↗</button> : shown.text}
      </dd>
      {hint && showHint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

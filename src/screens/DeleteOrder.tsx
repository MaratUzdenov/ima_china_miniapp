import { useEffect, useMemo, useState } from 'react';
import { ApiError, deleteOrder, newRequestId } from '../api';
import { isNum, rub } from '../format';
import { notifySuccess, useTelegramBack } from '../telegram';
import type { DeleteResult, Order } from '../types';

interface Props {
  order: Order;
  groupSize: number;          // сколько товаров в этом заказе (одна «Группа»)
  onDone: (r: DeleteResult) => void;
  onCancel: () => void;
}

// Подтверждение удаления — как в боте: что пропадёт, где копия, что клиенту ничего не придёт.
// Удалять можно только этот товар (строку); остальные товары группы остаются.
export function DeleteOrder({ order: o, groupSize, onDone, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestId = useMemo(() => newRequestId(), []);
  useEffect(() => useTelegramBack(saving ? null : onCancel), [saving, onCancel]);

  const paid = isNum(o.paid) && o.paid > 0 ? o.paid : 0;
  const started = !!o.status && o.status !== 'Принят' && o.status !== 'Отменён';

  const confirm = () => {
    setSaving(true);
    setError('');
    deleteOrder(o, requestId)
      .then(r => { notifySuccess(); onDone(r); })
      .catch(err => {
        setSaving(false);
        setError(err instanceof ApiError ? err.message : 'Не получилось удалить. Проверьте интернет и нажмите ещё раз — лишнего не удалится.');
      });
  };

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">🗑 Удалить заказ?</div>
        <div className="details__client">
          {o.client || 'Клиент не указан'} · {o.item || 'товар не указан'}{isNum(o.qty) ? ' × ' + o.qty : ''} · {o.status || 'без статуса'}
        </div>
        <ul className="delete__list">
          <li>Строка исчезнет из «Заказов», дашборда и бота.</li>
          <li>Копия сохранится на листе «Удалённые» — оттуда заказ можно вернуть вручную.</li>
          <li>Клиенту ничего не придёт.</li>
          {groupSize > 1 && <li>Удаляется только этот товар. Остальные товары заказа ({groupSize - 1}) останутся.</li>}
        </ul>
        {paid > 0 && (
          <div className="notice notice--error">⚠️ По заказу уже получено {rub(paid)}. После удаления этих денег не будет в учёте и в дашборде.</div>
        )}
        {started && (
          <div className="notice">Заказ уже «{o.status}». Если клиент его ждёт — предупредите клиента сами.</div>
        )}
        {error && <div className="notice notice--error">{error}</div>}
        <div className="actions">
          <button className="button button--danger" onClick={confirm} disabled={saving}>
            {saving ? 'Удаляю…' : '🗑 Да, удалить'}
          </button>
          <button className="button button--secondary" onClick={onCancel} disabled={saving}>Не удалять</button>
        </div>
      </section>
    </div>
  );
}

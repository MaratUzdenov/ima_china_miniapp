import { useEffect, useMemo, useState } from 'react';
import { ApiError, mergeGroup, splitGroup } from '../api';
import { norm } from '../format';
import { notifySuccess, useTelegramBack } from '../telegram';
import type { GroupResult, Order } from '../types';

interface Props {
  order: Order;
  all: Order[];
  onDone: (r: GroupResult, text: string) => void;
  onCancel: () => void;
}

// Группа заказа: объединить с другим незавершённым заказом этого же клиента или отделить от группы.
// Список кандидатов — из уже загруженных заказов (без лишнего запроса); правила ещё раз проверяет бэкенд.
export function GroupOrder({ order: o, all, onDone, onCancel }: Props) {
  const [saving, setSaving] = useState<string | null>(null); // ID цели или 'split'
  const [error, setError] = useState('');
  useEffect(() => useTelegramBack(saving ? null : onCancel), [saving, onCancel]);

  const mates = all.filter(x => x.groupId === o.groupId && x.id !== o.id);
  // Другие заказы того же клиента, сгруппированные; берём группы, где есть хоть один незавершённый товар.
  const candidates = useMemo(() => {
    const client = norm(o.client);
    if (!client) return [];
    const byGroup = new Map<string, Order[]>();
    all.forEach(x => {
      if (x.groupId === o.groupId || norm(x.client) !== client) return;
      byGroup.set(x.groupId, [...(byGroup.get(x.groupId) || []), x]);
    });
    return [...byGroup.values()]
      .filter(items => items.some(x => !x.isFinal))
      .sort((a, b) => (b[0].createdAt || '').localeCompare(a[0].createdAt || ''));
  }, [all, o]);

  const run = (key: string, action: () => Promise<GroupResult>, text: (r: GroupResult) => string) => {
    setSaving(key);
    setError('');
    action()
      .then(r => { notifySuccess(); onDone(r, text(r)); })
      .catch(err => {
        setSaving(null);
        setError(err instanceof ApiError ? err.message : 'Не получилось сохранить. Проверьте интернет и нажмите ещё раз.');
      });
  };
  const merge = (target: Order) => run(target.id, () => mergeGroup(o, target, all), r =>
    r.changed ? '🧺 Объединено: теперь этот заказ вместе с ' + target.id + '.' : 'ℹ️ Эти заказы уже в одной группе.');
  const split = () => run('split', () => splitGroup(o, all), r =>
    r.changed ? '✂️ Отделён — теперь это отдельный заказ.' : 'ℹ️ Заказ и так один в группе.');

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">🧺 Группа заказа</div>
        <div className="details__client">{o.client || 'Клиент не указан'} · {o.item || 'товар не указан'}</div>
        {mates.length > 0 && (
          <div className="details__note">Сейчас вместе с ним: {mates.map(m => m.id + ' ' + (m.item || '')).join(', ')}</div>
        )}
      </section>

      {error && <div className="notice notice--error">{error}</div>}

      {o.isFinal ? (
        <div className="notice">Заказ уже «{o.status}» — завершённые заказы не объединяем.</div>
      ) : (
        <section className="card">
          <h2 className="section__title">С каким заказом объединить?</h2>
          <div className="details__note">Только незавершённые заказы клиента «{o.client}».{mates.length > 0 ? ' Соседи по группе перейдут вместе с этим заказом.' : ''}</div>
          {candidates.length === 0 && <div className="dash__sub">У клиента нет других незавершённых заказов — объединять не с чем.</div>}
          {candidates.map(items => {
            const head = items.find(x => x.id === x.groupId) || items[0];
            return (
              <button key={head.groupId} className="group-pick" onClick={() => merge(head)} disabled={saving !== null}>
                <span className="group-pick__main">
                  <span><b>{head.id}</b> · {head.status || 'без статуса'}</span>
                  <span className="group-pick__items">{items.map(x => (x.item || 'товар') + (typeof x.qty === 'number' ? ' × ' + x.qty : '')).join(', ')}</span>
                </span>
                <span className="group-pick__go">{saving === head.id ? '⏳' : 'Объединить ›'}</span>
              </button>
            );
          })}
        </section>
      )}

      {mates.length > 0 && (
        <button className="button button--secondary" onClick={split} disabled={saving !== null}>
          {saving === 'split' ? 'Сохраняю…' : '✂️ Отделить от группы'}
        </button>
      )}
    </div>
  );
}

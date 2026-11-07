import { isNum, orderWarnings, plural, rub, shortDate } from '../format';
import type { Order } from '../types';
import { StatusProgress } from './StatusProgress';

interface Props {
  items: Order[];   // товары одного заказа клиента (одна группа)
  chain: string[];
  today: string;
}

// Карточка заказа клиента. Несколько товаров («вместе с заказом A-…») — одной карточкой, каждый своей строкой.
export function OrderGroupCard({ items, chain, today }: Props) {
  const first = items[0]; // самый ранний товар группы — по нему дата
  const debt = items.reduce((sum, o) => sum + (isNum(o.due) && o.due > 0 ? o.due : 0), 0);
  return (
    <article className="card">
      <header className="card__head">
        <div className="card__client">{first.client || 'Клиент не указан'}</div>
        <div className="card__meta">
          {shortDate(first.date)}{items.length > 1 ? ` · ${items.length} ${plural(items.length, 'товар', 'товара', 'товаров')}` : ''}
        </div>
      </header>
      {items.map(o => {
        const warnings = orderWarnings(o, today);
        return (
          <div key={o.id} className="item">
            <div className="item__title">
              {o.item || 'Товар не указан'}
              {isNum(o.qty) && <span className="item__qty"> × {o.qty}</span>}
            </div>
            <div className="item__id">{o.id}</div>
            <StatusProgress status={o.status} chain={chain} />
            {warnings.length > 0 && (
              <div className="chips">
                {warnings.map(w => <span key={w.text} className={'chip chip--' + w.level}>{w.text}</span>)}
              </div>
            )}
          </div>
        );
      })}
      {debt > 0 && <footer className="card__debt">Осталось получить: <b>{rub(debt)}</b></footer>}
    </article>
  );
}

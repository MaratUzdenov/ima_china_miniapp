import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, demoMode, fetchDashboard, takeDashboardStale } from '../api';
import { ErrorState } from '../components/States';
import { HelpTip } from '../components/HelpTip';
import { isNum, norm, plural, rub, shortDate, shortDateTime } from '../format';
import { readPref, savePref } from '../prefs';
import type { DashboardData, DashboardDebtor, DashboardPeriod, DashboardWarning, Order, OrdersFilter } from '../types';

// Экран «Дашборд»: открыл утром — за 10 секунд понял, что горит, кто должен, что в работе и сколько ждём.
// Ничего не считает сам: цифры приходят готовыми с бэкенда (те же, что /summary в боте).
// Здесь только показ и переходы в «Заказы» с фильтром.

const PERIODS: { key: DashboardPeriod; title: string }[] = [
  { key: '7d', title: '7 дней' },
  { key: '30d', title: '30 дней' },
  { key: 'all', title: 'Всё время' },
];
const PERIOD_KEYS = PERIODS.map(p => p.key);
const DEBTORS_SHOWN = 5;
// Бэкенд помнит ответ столько же — раньше переспрашивать нет смысла.
const STALE_AFTER_MS = 90_000;
const DELIVERED = 'Доставлен';
const NO_STATUS = 'без статуса';

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; data: DashboardData; refreshing: boolean; error: string };

interface Props {
  nav: ReactNode;
  active: boolean;
  onOpenOrders: (f: OrdersFilter) => void;
}

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Неизвестная ошибка. Нажмите «Повторить».');

// ── Фильтры для перехода в «Заказы» ──
const byIds = (title: string, ids: string[]): OrdersFilter => {
  const set = new Set(ids);
  return { title, match: o => set.has(o.id) };
};
const byClients = (title: string, names: string[]): OrdersFilter => {
  const set = new Set(names.map(norm));
  return { title, match: o => set.has(norm(o.client)) && isNum(o.due) && o.due > 0 };
};
const statusFilter = (status: string): OrdersFilter => ({
  title: 'Статус «' + status + '»',
  match: o => !o.isFinal && (o.status || NO_STATUS) === status,
});
const inRange = (date: string | null, from: string | null) => !!date && (!from || date.slice(0, 10) >= from);

export function DashboardScreen({ nav, active, onOpenOrders }: Props) {
  const [period, setPeriod] = useState<DashboardPeriod>(() => readPref('dashPeriod', PERIOD_KEYS, '30d'));
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const requestNo = useRef(0);     // ответ на старый запрос (сменили период) не должен перебить новый
  const loadedAt = useRef(0);

  const fetchData = useCallback((p: DashboardPeriod, refresh: boolean) => {
    const no = ++requestNo.current;
    setLoad(prev => (prev.state === 'ready' ? { ...prev, refreshing: true, error: '' } : { state: 'loading' }));
    fetchDashboard(p, refresh)
      .then(data => {
        if (no !== requestNo.current) return;
        loadedAt.current = Date.now();
        setLoad({ state: 'ready', data, refreshing: false, error: '' });
      })
      .catch(err => {
        if (no !== requestNo.current) return;
        // Цифры уже есть — оставляем их и показываем ошибку сверху; иначе — экран ошибки.
        setLoad(prev => (prev.state === 'ready'
          ? { ...prev, refreshing: false, error: errorText(err) }
          : { state: 'error', message: errorText(err) }));
      });
  }, []);

  // Открыли раздел: грузим, если данных нет, они старше 90 с или в «Заказах» что-то меняли.
  useEffect(() => {
    if (!active) return;
    const stale = takeDashboardStale();
    if (!loadedAt.current || stale || Date.now() - loadedAt.current > STALE_AFTER_MS) fetchData(period, stale);
    // period намеренно не в зависимостях: смену периода обрабатывает choosePeriod
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fetchData]);

  const choosePeriod = (p: DashboardPeriod) => {
    if (p === period) return;
    setPeriod(p);
    savePref('dashPeriod', p);
    fetchData(p, false);
  };
  const refresh = () => fetchData(period, true);

  return (
    <div className="screen screen--tabbar screen--dash">
      {nav}
      {demoMode && <div className="banner">Демо-данные: таблица ещё не подключена.</div>}

      {load.state === 'loading' && <DashboardSkeleton />}
      {load.state === 'error' && <ErrorState message={load.message} onRetry={refresh} />}
      {load.state === 'ready' && (
        <div className={'list' + (load.refreshing ? ' dash--refreshing' : '')} aria-busy={load.refreshing}>
          <div className="dash__updated">
            <span>{load.refreshing ? 'Обновляю…' : 'Обновлено ' + shortDateTime(load.data.updatedAt)}</span>
            <button className="link dash__refresh" onClick={refresh} disabled={load.refreshing}>Обновить</button>
          </div>
          {load.error && (
            <div className="notice notice--error">{load.error} <button className="link" onClick={refresh}>Повторить</button></div>
          )}
          {isEmpty(load.data) ? (
            <div className="state">
              <div className="state__icon">📭</div>
              <div className="state__title">Пока нет заказов</div>
              <div className="state__hint">Внесите первый заказ — кнопкой «➕ Новый заказ» в разделе «Заказы» или строкой в боте. Здесь появятся деньги, долги и сроки.</div>
            </div>
          ) : (
            <>
              <FireCard warnings={load.data.warnings} onOpen={onOpenOrders} />
              <DebtsCard data={load.data} onOpen={onOpenOrders} />
              <InWorkCard data={load.data} onOpen={onOpenOrders} />
              <ProfitCard data={load.data} onOpen={onOpenOrders} />
              <PeriodBlock data={load.data} period={period} onPeriod={choosePeriod} onOpen={onOpenOrders} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function isEmpty(d: DashboardData): boolean {
  return d.inWork.total === 0 && d.debts.clients.length === 0 && d.debts.cargo.sum === 0 &&
    d.period.newOrders.total === 0 && d.delivery.counted === 0 && d.warnings.length === 0;
}

// ── Виджеты ──

function Card({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section className="card dash">
      <h2 className="dash__title">
        {title}
        {help && <HelpTip text={help} label={title} />}
      </h2>
      {children}
    </section>
  );
}

function Row({ left, right, tone, onClick }: { left: ReactNode; right: ReactNode; tone?: 'red' | 'hint'; onClick?: () => void }) {
  return (
    <button className={'dash__row' + (tone ? ' dash__row--' + tone : '')} onClick={onClick} disabled={!onClick}>
      <span className="dash__row-left">{left}</span>
      <span className="dash__row-right">{right}{onClick && <span className="dash__chevron">›</span>}</span>
    </button>
  );
}

function FireCard({ warnings, onOpen }: { warnings: DashboardWarning[]; onOpen: (f: OrdersFilter) => void }) {
  const red = warnings.filter(w => w.level === 'red');
  const amber = warnings.filter(w => w.level === 'amber');
  // «Обратить внимание» можно скрыть — запоминаем выбор на этом телефоне. Красное не скрывается.
  const [showAmber, setShowAmber] = useState(() => readPref('dashAmber', ['1', '0'] as const, '1') === '1');
  const toggle = () => setShowAmber(v => { savePref('dashAmber', v ? '0' : '1'); return !v; });
  const open = (w: DashboardWarning) => onOpen(w.kind === 'clients' ? byClients(w.title, w.ids) : byIds(w.title, w.ids));
  const row = (w: DashboardWarning) => (
    <Row key={w.key} tone={w.level === 'red' ? 'red' : undefined}
      left={(w.level === 'red' ? '🔴 ' : '⚠️ ') + w.title} right={<b>{w.ids.length}</b>} onClick={() => open(w)} />
  );
  return (
    <Card title="🔥 Что горит" help="Те же проверки, что «На что обратить внимание» в /summary бота. Только заказы в работе. Нажмите на строку — откроются эти заказы.">
      {red.length === 0 && <div className="dash__ok">✅ Срочного нет</div>}
      {red.map(row)}
      {amber.length > 0 && (
        <>
          <button className="dash__toggle" onClick={toggle} aria-expanded={showAmber}>
            {showAmber ? '▾' : '▸'} Обратить внимание · {amber.length}
          </button>
          {showAmber && amber.map(row)}
        </>
      )}
    </Card>
  );
}

function DebtsCard({ data, onOpen }: { data: DashboardData; onOpen: (f: OrdersFilter) => void }) {
  const { debts, thresholds } = data;
  const [all, setAll] = useState(false);
  const shown = all ? debts.clients : debts.clients.slice(0, DEBTORS_SHOWN);
  const meta = (d: DashboardDebtor) => (d.days === null ? 'ещё не выдан' : d.days + ' дн.');
  return (
    <Card title="🧾 Клиенты должны"
      help={'Предоплата — долг с даты заказа, «оплата потом» — с даты выдачи (до выдачи это ещё не долг). Красным — дольше ' +
        thresholds.debtDays + ' дн. (порог в Настройках). Комиссии карго — отдельной строкой.'}>
      <div className="dash__big">{rub(debts.total)}</div>
      <div className={'dash__sub' + (debts.overdueCount ? ' dash__sub--red' : '')}>
        {debts.clients.length === 0 ? 'Никто не должен 👍'
          : debts.overdueCount ? `просрочено у ${debts.overdueCount} ${plural(debts.overdueCount, 'клиента', 'клиентов', 'клиентов')}`
          : `${debts.clients.length} ${plural(debts.clients.length, 'клиент', 'клиента', 'клиентов')}, просроченных нет`}
      </div>
      {shown.map(d => (
        <Row key={d.name} tone={d.overdue ? 'red' : undefined}
          left={<>{d.name || 'без имени'}<span className="dash__meta"> · {meta(d)}</span></>}
          right={rub(d.sum)} onClick={() => onOpen(byClients('Долг: ' + d.name, [d.name]))} />
      ))}
      {debts.clients.length > DEBTORS_SHOWN && (
        <button className="dash__toggle" onClick={() => setAll(v => !v)}>
          {all ? 'Свернуть' : 'Показать всех · ' + debts.clients.length}
        </button>
      )}
      {debts.cargo.sum > 0 && (
        <Row tone="hint" left="Карго должно комиссий" right={rub(debts.cargo.sum)}
          onClick={() => onOpen(byIds('Карго должно комиссий', debts.cargo.ids))} />
      )}
    </Card>
  );
}

function InWorkCard({ data, onOpen }: { data: DashboardData; onOpen: (f: OrdersFilter) => void }) {
  const { total, byStatus } = data.inWork;
  const max = Math.max(1, ...byStatus.map(s => s.count));
  return (
    <Card title="📦 В работе" help="Все заказы, кроме «Доставлен» и «Отменён». Один товар — один заказ (как в таблице и /summary).">
      <div className="dash__big">{total} <span className="dash__unit">{plural(total, 'заказ', 'заказа', 'заказов')}</span></div>
      {total === 0 && <div className="dash__sub">Сейчас нет заказов в работе</div>}
      {byStatus.map(s => (
        <button key={s.status} className="dash__bar-row" onClick={() => onOpen(statusFilter(s.status))}>
          <span className="dash__bar-label">{s.status}</span>
          <span className="dash__bar"><span className="dash__bar-fill" style={{ width: (s.count / max) * 100 + '%' }} /></span>
          <b className="dash__bar-count">{s.count}</b>
        </button>
      ))}
    </Card>
  );
}

function ProfitCard({ data, onOpen }: { data: DashboardData; onOpen: (f: OrdersFilter) => void }) {
  const { profit } = data;
  return (
    <Card title="💰 Ожидаемая прибыль"
      help="Сумма колонки «Прибыль» по заказам в работе. Пока цена продажи не вписана — по оценке «примерно». Для схемы «через карго» — комиссия от карго.">
      <div className={'dash__big' + (profit.sum < 0 ? ' dash__big--red' : '')}>{rub(profit.sum)}</div>
      <div className="dash__sub">
        по {profit.counted} {plural(profit.counted, 'заказу', 'заказам', 'заказам')}
      </div>
      {profit.missing > 0 && (
        <Row tone="hint" left={`Не посчитана в ${profit.missing} — нет веса, способа доставки или тарифа карго`} right=""
          onClick={() => onOpen(byIds('Прибыль не посчитана', profit.missingIds))} />
      )}
    </Card>
  );
}

function PeriodBlock({ data, period, onPeriod, onOpen }: {
  data: DashboardData; period: DashboardPeriod; onPeriod: (p: DashboardPeriod) => void; onOpen: (f: OrdersFilter) => void;
}) {
  const { period: p, delivery } = data;
  const from = p.from;
  const since = from ? 'с ' + shortDate(from) : 'за всё время';
  // Ответ мог прийти ещё за старый период (идёт загрузка нового) — цифры подписываем тем, за что они посчитаны.
  const label = PERIODS.find(x => x.key === p.key)?.title.toLowerCase() || '';
  return (
    <>
      <div className="dash__period">
        <h2 className="dash__title dash__title--plain">📅 За период</h2>
        <div className="choices" role="radiogroup" aria-label="Период">
          {PERIODS.map(x => (
            <button key={x.key} role="radio" aria-checked={period === x.key}
              className={'choice' + (period === x.key ? ' choice--on' : '')} onClick={() => onPeriod(x.key)}>{x.title}</button>
          ))}
        </div>
        <div className="dash__sub">{p.key === 'all' ? 'За всё время' : 'Последние ' + label + ', ' + since}</div>
      </div>

      <div className="dash__grid">
        <button className="card dash dash__tile"
          onClick={() => onOpen({ title: 'Новые заказы ' + since, match: (o: Order) => inRange(o.date, from) })}>
          <span className="dash__tile-title">Новых заказов</span>
          <span className="dash__big">{p.newOrders.total}</span>
          <span className="dash__sub">{p.newOrders.cancelled ? `из них отменено ${p.newOrders.cancelled}` : 'по дате заказа'}</span>
        </button>
        <button className="card dash dash__tile"
          onClick={() => onOpen({ title: 'Выдано ' + since, match: (o: Order) => o.status === DELIVERED && inRange(o.deliveredDate, from) })}>
          <span className="dash__tile-title">Заработано</span>
          <span className={'dash__big' + (p.earned.sum < 0 ? ' dash__big--red' : '')}>{rub(p.earned.sum)}</span>
          <span className="dash__sub">на {p.earned.counted} {plural(p.earned.counted, 'выданном', 'выданных', 'выданных')}</span>
        </button>
      </div>

      <Card title="🚚 Средний срок доставки"
        help="От «Даты» заказа до «Факт. даты выдачи» — по доставленным заказам, выданным за выбранный период. Без даты выдачи заказ в расчёт не попадает.">
        {delivery.avgDays === null ? (
          <>
            <div className="dash__big dash__big--hint">—</div>
            <div className="dash__sub">Пока нет данных: нужны доставленные заказы с «Факт. датой выдачи»</div>
          </>
        ) : (
          <>
            <div className="dash__big">{fmtDays(delivery.avgDays)} <span className="dash__unit">{plural(Math.round(delivery.avgDays), 'день', 'дня', 'дней')}</span></div>
            <div className="dash__sub">
              {delivery.minDays === delivery.maxDays ? '' : `от ${delivery.minDays} до ${delivery.maxDays} дн. · `}
              по {delivery.counted} {plural(delivery.counted, 'заказу', 'заказам', 'заказам')}
            </div>
          </>
        )}
        {delivery.noDateIds.length > 0 && (
          <Row tone="hint" left={`Доставлено без «Факт. даты выдачи»: ${delivery.noDateIds.length}`} right=""
            onClick={() => onOpen(byIds('Нет даты выдачи', delivery.noDateIds))} />
        )}
        {delivery.badDateIds.length > 0 && (
          <Row tone="red" left={`Дата выдачи раньше даты заказа: ${delivery.badDateIds.length}`} right=""
            onClick={() => onOpen(byIds('Дата выдачи раньше даты заказа', delivery.badDateIds))} />
        )}
      </Card>
    </>
  );
}

const fmtDays = (d: number) => String(d).replace('.', ',');

function DashboardSkeleton() {
  return (
    <div className="list" aria-busy="true" aria-label="Загрузка дашборда">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="card skeleton">
          <div className="skeleton__line skeleton__line--short" />
          <div className="skeleton__line dash__skeleton-big" />
          <div className="skeleton__line" />
        </div>
      ))}
    </div>
  );
}

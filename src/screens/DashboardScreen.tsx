import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, demoMode, fetchDashboard, takeDashboardStale } from '../api';
import { ErrorState } from '../components/States';
import { HelpTip } from '../components/HelpTip';
import { isNum, norm, plural, rub, shortDate, shortDateTime } from '../format';
import { readPref, savePref } from '../prefs';
import type { DashboardData, DashboardDebtor, DashboardPeriod, DashboardWarning, DeliveryByMethod, MoneySide, Order, OrdersFilter } from '../types';
import type { TimelineMeasure } from '../components/TimelineChart';

// Библиотека графиков — отдельным файлом: грузится, только когда дашборд открыт.
const TimelineChart = lazy(() => import('../components/TimelineChart'));

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

      <DynamicsCard data={data} />
      <MoneyCard data={data} since={since} onOpen={onOpen} />

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
        {delivery.byMethod.length > 0 && <MethodBars methods={delivery.byMethod} />}
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

// ── График 1: динамика — новые заказы или заработано по дням / неделям / месяцам ──
const UNIT_TEXT = { day: 'по дням', week: 'по неделям', month: 'по месяцам' } as const;

function DynamicsCard({ data }: { data: DashboardData }) {
  const [measure, setMeasure] = useState<TimelineMeasure>(() => readPref('dashMeasure', ['orders', 'earned'] as const, 'orders'));
  const pick = (m: TimelineMeasure) => { setMeasure(m); savePref('dashMeasure', m); };
  const { timeline } = data.charts;
  const empty = timeline.buckets.every(b => (measure === 'orders' ? b.newOrders : b.earned) === 0);
  return (
    <Card title={'📈 Динамика ' + UNIT_TEXT[timeline.unit]}
      help="Новые заказы — по дате заказа. Заработано — прибыль выданных заказов по дате выдачи. Сумма столбцов равна плиткам выше. Нажмите на столбец — покажу точное число.">
      <div className="choices choices--compact" role="radiogroup" aria-label="Что показать">
        <button role="radio" aria-checked={measure === 'orders'} className={'choice' + (measure === 'orders' ? ' choice--on' : '')}
          onClick={() => pick('orders')}>Заказы</button>
        <button role="radio" aria-checked={measure === 'earned'} className={'choice' + (measure === 'earned' ? ' choice--on' : '')}
          onClick={() => pick('earned')}>Заработано</button>
      </div>
      {empty ? (
        <div className="dash__sub chart-empty">
          {measure === 'orders' ? 'За этот период новых заказов нет.' : 'Пока нечего показать: заработок появится, когда заказы будут выданы клиентам.'}
        </div>
      ) : (
        <Suspense fallback={<div className="skeleton__line chart-skeleton" />}>
          <TimelineChart timeline={timeline} measure={measure} />
        </Suspense>
      )}
    </Card>
  );
}

// ── График 2: деньги по заказам за период — получено и осталось (клиенты и карго отдельно) ──
function MoneyCard({ data, since, onOpen }: { data: DashboardData; since: string; onOpen: (f: OrdersFilter) => void }) {
  const { money } = data.charts;
  const from = data.period.from;
  const owed = (payer: string): OrdersFilter => ({
    title: 'Не оплачено ' + since + (payer === 'Карго' ? ' (карго)' : ''),
    match: (o: Order) => o.status !== 'Отменён' && o.payer === payer && isNum(o.due) && o.due > 0 && inRange(o.date, from),
  });
  const nothing = money.client.orders === 0 && money.cargo.orders === 0;
  return (
    <Card title="💳 Деньги по заказам за период"
      help="Заказы, принятые за выбранный период (кроме отменённых): сколько всего ждём, сколько уже получено и сколько осталось. Комиссии карго — отдельной полосой.">
      {nothing && <div className="dash__sub">{money.notCounted ? 'Суммы ещё не посчитаны — не хватает цены, веса или тарифа карго.' : 'За этот период заказов нет.'}</div>}
      {money.client.orders > 0 && <MoneyBar title="Клиенты" side={money.client} onOpen={() => onOpen(owed('Клиент'))} />}
      {money.cargo.orders > 0 && <MoneyBar title="Комиссии карго" side={money.cargo} onOpen={() => onOpen(owed('Карго'))} />}
      {!nothing && money.notCounted > 0 && (
        <div className="dash__sub">Ещё {money.notCounted} {plural(money.notCounted, 'заказ', 'заказа', 'заказов')} без суммы — нет цены, схемы оплаты или тарифа карго</div>
      )}
    </Card>
  );
}

function MoneyBar({ title, side, onOpen }: { title: string; side: MoneySide; onOpen: () => void }) {
  // Доли считаем от «ждём»; переплату показываем текстом — она не помещается в 100%.
  const total = Math.max(side.expected, side.paid, 1);
  const paidPct = Math.min(100, (Math.min(side.paid, side.expected) / total) * 100);
  const duePct = Math.min(100 - paidPct, (side.due / total) * 100);
  return (
    <button className="mbar" onClick={onOpen} disabled={side.due <= 0}
      aria-label={`${title}: ждём ${rub(side.expected)}, получено ${rub(side.paid)}, осталось ${rub(side.due)}`}>
      <span className="mbar__head">
        <span>{title} · {side.orders} {plural(side.orders, 'заказ', 'заказа', 'заказов')}</span>
        <b>{rub(side.expected)}</b>
      </span>
      <span className="mbar__bar" aria-hidden="true">
        {paidPct > 0 && <span className="mbar__paid" style={{ width: paidPct + '%' }} />}
        {duePct > 0 && <span className="mbar__due" style={{ width: duePct + '%' }} />}
      </span>
      <span className="mbar__legend">
        <span><i className="mbar__dot mbar__dot--paid" />Получено {rub(side.paid)}</span>
        <span><i className="mbar__dot mbar__dot--due" />Осталось {rub(side.due)}{side.due > 0 && <span className="dash__chevron"> ›</span>}</span>
      </span>
      {side.overpaid > 0 && <span className="mbar__over">Переплата {rub(side.overpaid)} — вернуть или зачесть</span>}
    </button>
  );
}

// ── График 3: срок доставки по способам против обещанного в Справочниках ──
function MethodBars({ methods }: { methods: DeliveryByMethod[] }) {
  const scale = Math.max(1, ...methods.map(m => Math.max(m.avgDays, m.maxDays, m.promisedMax ?? 0)));
  const pct = (d: number) => (d / scale) * 100;
  return (
    <div className="methods">
      <div className="methods__title">По способам доставки — факт против обещанного в Справочниках</div>
      {methods.map(m => {
        const late = m.promisedMax !== null && m.avgDays > m.promisedMax;
        const hasPromise = m.promisedMin !== null && m.promisedMax !== null;
        return (
          <div key={m.method} className="method">
            <div className="method__head">
              <span>{m.method} <span className="dash__meta">· {m.count} {plural(m.count, 'заказ', 'заказа', 'заказов')}</span></span>
              <b>{fmtDays(m.avgDays)} дн.</b>
            </div>
            <div className="method__track" aria-hidden="true">
              {hasPromise && (
                <span className="method__promise" style={{ left: pct(m.promisedMin!) + '%', width: Math.max(1, pct(m.promisedMax!) - pct(m.promisedMin!)) + '%' }} />
              )}
              <span className={'method__fact' + (late ? ' method__fact--late' : '')} style={{ width: pct(m.avgDays) + '%' }} />
            </div>
            <div className={'method__note' + (late ? ' method__note--late' : '')}>
              {!hasPromise ? 'Срок в Справочниках не указан'
                : late ? `⚠️ Дольше обещанного: в Справочниках ${m.promisedMin}–${m.promisedMax} дн.`
                : `✅ В пределах обещанного: ${m.promisedMin}–${m.promisedMax} дн.`}
            </div>
          </div>
        );
      })}
      <div className="methods__legend">
        <span><i className="mbar__dot mbar__dot--paid" />средний факт</span>
        <span><i className="mbar__dot method__dot--promise" />обещано</span>
      </div>
    </div>
  );
}

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

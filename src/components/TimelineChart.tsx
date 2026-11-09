import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bucketTick, bucketTitle, compactRub } from '../chartFormat';
import { plural, rub } from '../format';
import type { Timeline } from '../types';

// График «Динамика» — столбцы по дням / неделям / месяцам. Один показатель за раз (заказы ИЛИ рубли):
// две разные шкалы на одном графике читаются неверно, поэтому переключатель, а не вторая ось.
// Этот файл грузится отдельно (lazy) — библиотека графиков не замедляет открытие «Заказов».

export type TimelineMeasure = 'orders' | 'earned';

interface Point { key: string; tick: string; value: number }

export default function TimelineChart({ timeline, measure }: { timeline: Timeline; measure: TimelineMeasure }) {
  // Цвета задаёт CSS (.chart …) из темы Telegram: SVG-атрибуты здесь только запасные.
  const data: Point[] = timeline.buckets.map(b => ({
    key: b.key,
    tick: bucketTick(b.key, timeline.unit),
    value: measure === 'orders' ? b.newOrders : b.earned,
  }));
  const isMoney = measure === 'earned';
  const fmt = (v: number) => (isMoney ? rub(v) : v + ' ' + plural(v, 'заказ', 'заказа', 'заказов'));

  return (
    <div className="chart" role="img" aria-label={(isMoney ? 'Заработано' : 'Новые заказы') + ': ' +
      data.map(d => bucketTitle(d.key, timeline.unit) + ' — ' + fmt(d.value)).join('; ')}>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="tick" tickLine={false} interval={0} tick={{ fontSize: 11 }} />
          <YAxis width={isMoney ? 56 : 28} allowDecimals={false} tickLine={false} axisLine={false}
            tick={{ fontSize: 11 }} tickFormatter={v => (isMoney ? compactRub(v) : String(v))} />
          <Tooltip cursor={{ className: 'chart__cursor' }} isAnimationActive={false}
            content={({ active, payload }) => {
              const p = active && payload && payload[0] ? (payload[0].payload as Point) : null;
              if (!p) return null;
              return (
                <div className="chart-tip">
                  <div className="chart-tip__title">{bucketTitle(p.key, timeline.unit)}</div>
                  <div className="chart-tip__value">{fmt(p.value)}</div>
                </div>
              );
            }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
            {data.map(d => <Cell key={d.key} className={d.value < 0 ? 'chart__bar chart__bar--neg' : 'chart__bar'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

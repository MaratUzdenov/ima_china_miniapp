import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, demoMode, fetchFieldsMeta, setField, timingText } from '../api';
import { SkeletonList } from '../components/States';
import { DETAIL_GROUPS } from '../fields';
import { formatField } from '../format';
import { notifySuccess, useTelegramBack } from '../telegram';
import type { FieldMeta, FieldsMeta, Order } from '../types';

interface Props {
  order: Order;
  onOrderUpdated: (o: Order) => void;
  onClose: () => void;
}

// Формат показа значения берём из карточки заказа (fields.ts): деньги — «₽», вес — «кг»…
const DISPLAY_FMT: Record<string, string | undefined> = Object.fromEntries(
  DETAIL_GROUPS.flatMap(g => g.fields).map(f => [f.key, f.fmt]));

// Правка заказа по одному полю: список групп → поле → сохранить. Каждое сохранение — отдельная запись в Лог.
export function EditOrder({ order: o, onOrderUpdated, onClose }: Props) {
  const [meta, setMeta] = useState<FieldsMeta | null>(null);
  const [loadError, setLoadError] = useState('');
  const [field, setFieldMeta] = useState<FieldMeta | null>(null);
  const [notices, setNotices] = useState<{ text: string; error: boolean }[]>([]);
  // Поля, которые сейчас сохраняются. Сохранение идёт в фоне — человек сразу возвращается к списку полей.
  const [pending, setPending] = useState<Record<string, string>>({});
  // Сохранения строго по очереди: ответ каждого приносит всю строку заказа, и порядок не должен перепутаться.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingCount = Object.keys(pending).length;
  // Самая свежая версия заказа — к моменту, когда до поля дойдёт очередь, предыдущие сохранения уже её обновили.
  const latest = useRef(o);
  latest.current = o;

  const addNotice = (text: string, error = false) => setNotices(prev => [{ text, error }, ...prev].slice(0, 4));

  const submit = useCallback((f: FieldMeta, value: string, clear: boolean) => {
    setPending(p => ({ ...p, [f.key]: clear ? 'очищаю' : value }));
    setFieldMeta(null);
    queue.current = queue.current.then(() => setField(latest.current, f.key, value, clear)
      .then(r => {
        notifySuccess();
        latest.current = r.order; // следующее в очереди сохранение возьмёт уже обновлённый заказ
        onOrderUpdated(r.order);
        const parts = ['✅ ' + shortTitle(f.title) + ': ' + (r.old || '—') + ' → ' + (r.new || '—')];
        if (r.clientAdded) parts.push('🆕 Новый клиент добавлен в «Клиенты».');
        if (r.warn) parts.push('⚠️ ' + r.warn);
        addNotice(parts.join(' ') + timingText());
      })
      .catch(err => addNotice('❌ ' + shortTitle(f.title) + ' не сохранено: ' + errText(err), true))
      .finally(() => setPending(p => { const n = { ...p }; delete n[f.key]; return n; })));
  }, [onOrderUpdated]);

  const load = useCallback(() => {
    setLoadError('');
    fetchFieldsMeta().then(setMeta).catch(err => setLoadError(errText(err)));
  }, []);
  useEffect(load, [load]);

  const closeField = useCallback(() => setFieldMeta(null), []);
  // Пока что-то сохраняется — не уходим: иначе ошибку сохранения никто не увидит.
  useEffect(() => (field ? undefined : useTelegramBack(pendingCount ? null : onClose)), [field, onClose, pendingCount]);
  useEffect(() => { if (!field) window.scrollTo(0, 0); }, [field]);

  if (field) {
    return (
      <FieldEditor order={o} field={field} onCancel={closeField} onSubmit={submit} />
    );
  }

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">✏️ Редактировать</div>
        <div className="details__client">{o.item} · {o.client}</div>
        <div className="details__note">Нажмите на поле, чтобы изменить. Серые расчётные поля (суммы, прибыль, сроки) таблица пересчитает сама. Статус — кнопкой «Сменить статус».</div>
        {pendingCount > 0 && <div className="notice">⏳ Сохраняю ({pendingCount})… Пока не закрывайте экран.</div>}
        {notices.map((n, i) => <div key={i} className={'notice' + (n.error ? ' notice--error' : '')}>{n.text}</div>)}
      </section>

      {loadError && (
        <section className="card">
          <div className="details__note">{loadError}</div>
          <div className="actions"><button className="button" onClick={load}>Повторить</button></div>
        </section>
      )}
      {!meta && !loadError && <SkeletonList />}

      {meta && meta.groups.map(g => (
        <section key={g.title} className="card">
          <h2 className="section__title">{g.title}</h2>
          <div className="fields">
            {g.fields.map(f => {
              const shown = formatField(o[f.key], DISPLAY_FMT[f.key]);
              return (
                <button key={f.key} className="field field--button" disabled={f.key in pending} onClick={() => setFieldMeta(f)}>
                  <span className="field__title">{shortTitle(f.title)}</span>
                  {f.key in pending ? (
                    <span className="field__value field__value--hint">⏳ {pending[f.key]}</span>
                  ) : (
                    <span className={'field__value' + (shown.isHint ? ' field__value--hint' : '')}>
                      {f.kind === 'link' && o[f.key] ? 'есть ссылка' : shown.text} ›
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

interface EditorProps {
  order: Order;
  field: FieldMeta;
  onCancel: () => void;
  onSubmit: (f: FieldMeta, value: string, clear: boolean) => void;
}

function FieldEditor({ order: o, field: f, onCancel, onSubmit }: EditorProps) {
  const [text, setText] = useState(() => initialText(o[f.key], f.kind));
  const [error, setError] = useState('');
  const [showNote, setShowNote] = useState(false);
  const saving = false;

  useEffect(() => useTelegramBack(onCancel), [onCancel]);

  // Явные ошибки ловим сразу, на телефоне, — чтобы не узнать о них уже после возврата к списку.
  // Окончательная проверка всё равно на бэкенде (те же правила, что в боте).
  const save = (value: string, clear = false) => {
    const problem = clear || f.kind === 'list' ? '' : checkInput(value, f.kind);
    if (problem) { setError(problem); return; }
    onSubmit(f, value, clear);
  };

  const current = formatField(o[f.key], DISPLAY_FMT[f.key]);

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">{f.title}</div>
        <div className="details__client">Сейчас: {current.text}</div>
        {f.note && (
          <button className="link" onClick={() => setShowNote(v => !v)}>{showNote ? 'Скрыть подсказку' : 'Что сюда писать? ›'}</button>
        )}
        {showNote && <div className="field__hint">{f.note}</div>}
      </section>

      <section className="card">
        {f.kind === 'list' ? (
          <>
            {f.options.length === 0 && <div className="details__note">Список пустой — заполните его в Справочниках.</div>}
            <div className="options">
              {f.options.map(opt => (
                <button key={opt} className={'option' + (opt === o[f.key] ? ' option--on' : '')} disabled={saving} onClick={() => save(opt)}>
                  {opt}{opt === o[f.key] ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="section__title" htmlFor="fieldInput">Новое значение</label>
            {f.key === 'comment' ? (
              <textarea id="fieldInput" className="search textarea" value={text} disabled={saving} onChange={e => setText(e.target.value)} />
            ) : (
              <input
                id="fieldInput"
                className="search amount"
                type={f.kind === 'date' ? 'date' : 'text'}
                inputMode={INPUT_MODE[f.kind]}
                autoComplete="off"
                value={text}
                disabled={saving}
                onChange={e => setText(e.target.value)}
              />
            )}
            <div className="details__note">{f.hint}</div>
            <div className="actions">
              <button className="button" disabled={saving || !text.trim()} onClick={() => save(toServerText(text, f.kind))}>
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
            </div>
          </>
        )}
        {error && <div className="notice notice--error">{error}</div>}
        {f.clearable && o[f.key] !== null && o[f.key] !== undefined && o[f.key] !== '' && (
          <div className="actions">
            <button className="button button--ghost" disabled={saving} onClick={() => save('', true)}>🧹 Очистить</button>
          </div>
        )}
        {demoMode && <div className="details__note">Демо-режим: в таблицу ничего не запишется.</div>}
      </section>
    </div>
  );
}

const INPUT_MODE: Record<string, 'text' | 'numeric' | 'decimal' | 'url'> = {
  int: 'numeric', number: 'decimal', hs: 'numeric', link: 'url', text: 'text', client: 'text', date: 'text', list: 'text',
};

// Текущее значение — в поле ввода, чтобы поправить, а не набирать заново.
function initialText(v: unknown, kind: FieldMeta['kind']): string {
  if (v === null || v === undefined) return '';
  if (kind === 'date') return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return String(v);
}

// Бэкенд (как бот) ждёт дату в виде 07.11.2026, а поле даты на телефоне даёт 2026-11-07.
function toServerText(text: string, kind: FieldMeta['kind']): string {
  if (kind === 'date') {
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  }
  return text;
}

// «Цена продажи — факт (₽)» → «Цена продажи — факт»
function shortTitle(t: string): string {
  return t.replace(/\s*\([^)]*\)\s*$/, '');
}

// Те же правила, что parseFieldValue в боте (Edit.gs).
function checkInput(text: string, kind: FieldMeta['kind']): string {
  const t = text.trim();
  if (!t) return kind === 'date' ? 'Выберите дату.' : 'Пустое значение. Чтобы очистить поле — нажмите «Очистить».';
  const compact = t.replace(/[\s\u00a0]/g, '');
  switch (kind) {
    case 'int': return /^\d+$/.test(compact) && Number(compact) > 0 ? '' : 'Нужно целое число больше 0, например 100.';
    case 'number': return /^\d+([.,]\d+)?$/.test(compact) ? '' : 'Нужно число без букв и знаков, например 2,5 или 3500.';
    case 'link': return /^https?:\/\/\S+$/i.test(t) ? '' : 'Ссылка должна начинаться с https:// и быть без пробелов.';
    case 'hs': return t.replace(/\D/g, '').length === 10 ? '' : 'Код ТН ВЭД — ровно 10 цифр. Не знаете — уточните у брокера.';
    case 'client': return /^\d+$/.test(t) ? 'Похоже на число, а нужно имя клиента.' : '';
    default: return '';
  }
}

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.';
}

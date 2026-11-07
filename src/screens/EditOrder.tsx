import { useCallback, useEffect, useState } from 'react';
import { ApiError, demoMode, fetchFieldsMeta, setField } from '../api';
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
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    fetchFieldsMeta().then(setMeta).catch(err => setLoadError(errText(err)));
  }, []);
  useEffect(load, [load]);

  const closeField = useCallback(() => setFieldMeta(null), []);
  useEffect(() => (field ? undefined : useTelegramBack(onClose)), [field, onClose]);
  useEffect(() => { if (!field) window.scrollTo(0, 0); }, [field]);

  if (field) {
    return (
      <FieldEditor
        order={o}
        field={field}
        onCancel={closeField}
        onSaved={(fresh, text) => { onOrderUpdated(fresh); setNotice(text); setFieldMeta(null); }}
      />
    );
  }

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">✏️ Редактировать</div>
        <div className="details__client">{o.item} · {o.client}</div>
        <div className="details__note">Нажмите на поле, чтобы изменить. Серые расчётные поля (суммы, прибыль, сроки) таблица пересчитает сама. Статус — кнопкой «Сменить статус».</div>
        {notice && <div className="notice">{notice}</div>}
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
                <button key={f.key} className="field field--button" onClick={() => { setNotice(''); setFieldMeta(f); }}>
                  <span className="field__title">{shortTitle(f.title)}</span>
                  <span className={'field__value' + (shown.isHint ? ' field__value--hint' : '')}>
                    {f.kind === 'link' && o[f.key] ? 'есть ссылка' : shown.text} ›
                  </span>
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
  onSaved: (o: Order, notice: string) => void;
}

function FieldEditor({ order: o, field: f, onCancel, onSaved }: EditorProps) {
  const [text, setText] = useState(() => initialText(o[f.key], f.kind));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNote, setShowNote] = useState(false);

  useEffect(() => useTelegramBack(saving ? null : onCancel), [saving, onCancel]);

  const save = (value: string, clear = false) => {
    setSaving(true);
    setError('');
    setField(o, f.key, value, clear)
      .then(r => {
        notifySuccess();
        const parts = ['✅ ' + shortTitle(f.title) + ': ' + (r.old || '—') + ' → ' + (r.new || '—')];
        if (r.clientAdded) parts.push('🆕 Новый клиент добавлен в «Клиенты».');
        if (r.warn) parts.push('⚠️ ' + r.warn);
        onSaved(r.order, parts.join(' '));
      })
      .catch(err => { setSaving(false); setError(errText(err)); });
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

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.';
}

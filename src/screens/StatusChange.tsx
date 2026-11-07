import { useEffect, useState } from 'react';
import { ApiError, demoMode, previewStatus, setStatus } from '../api';
import { notifySuccess, useTelegramBack } from '../telegram';
import type { Order, StatusPreview, StatusResult } from '../types';

interface Props {
  order: Order;
  statuses: string[];
  onDone: (result: StatusResult) => void;
  onCancel: () => void;
}

type Step =
  | { kind: 'pick' }
  | { kind: 'loading'; status: string }
  | { kind: 'confirm'; preview: StatusPreview }
  | { kind: 'saving'; preview: StatusPreview }
  | { kind: 'error'; message: string; status?: string };

const NOTE_TEXT: Record<StatusPreview['note'], string> = {
  send: 'Клиент получит это сообщение в Telegram:',
  noTg: '⚠️ Клиент не подключён к боту — сообщение не уйдёт. Статус всё равно поменяется. Ссылка для клиента — в боте: «🔗 Ссылка клиенту».',
  off: 'ℹ️ Для этого статуса сообщение клиенту отключено (Справочники → «Сообщение клиенту»).',
  same: 'ℹ️ Этот статус уже стоит — менять нечего.',
};

// Смена статуса как в боте: выбрать → посмотреть, что уйдёт клиенту → подтвердить.
// Сообщение клиенту отменить нельзя, поэтому без шага подтверждения не пишем.
export function StatusChange({ order: o, statuses, onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'pick' });

  // «Назад» в шапке Telegram: из подтверждения — к выбору статуса, из выбора — в карточку.
  useEffect(() => {
    if (step.kind === 'saving') return useTelegramBack(null); // пока сохраняем — уйти нельзя
    const toPick = step.kind === 'confirm' || step.kind === 'error';
    return useTelegramBack(toPick ? () => setStep({ kind: 'pick' }) : onCancel);
  }, [step.kind, onCancel]);

  const choose = (status: string) => {
    setStep({ kind: 'loading', status });
    previewStatus(o, status)
      .then(preview => setStep({ kind: 'confirm', preview }))
      .catch(err => setStep({ kind: 'error', message: errText(err), status }));
  };

  const save = (preview: StatusPreview) => {
    setStep({ kind: 'saving', preview });
    setStatus(o, preview.to)
      .then(result => { notifySuccess(); onDone(result); })
      .catch(err => setStep({ kind: 'error', message: errText(err), status: preview.to }));
  };

  return (
    <div className="screen screen--details">
      <section className="card">
        <div className="item__id">{o.id}</div>
        <div className="details__title">Сменить статус</div>
        <div className="details__client">{o.item} · {o.client}</div>
        <div>Сейчас: <b>{o.status || 'без статуса'}</b></div>
      </section>

      {step.kind === 'pick' && (
        <section className="card">
          <h2 className="section__title">Новый статус</h2>
          <div className="options">
            {statuses.filter(s => s !== o.status).map(s => (
              <button key={s} className="option" onClick={() => choose(s)}>{s}</button>
            ))}
          </div>
        </section>
      )}

      {step.kind === 'loading' && (
        <section className="card"><div className="details__note">Готовлю сообщение клиенту для «{step.status}»…</div></section>
      )}

      {(step.kind === 'confirm' || step.kind === 'saving') && (
        <section className="card">
          <div className="transition">«{step.preview.from || 'без статуса'}» → «<b>{step.preview.to}</b>»</div>
          <div className="details__note">{NOTE_TEXT[step.preview.note]}</div>
          {step.preview.note === 'send' && <pre className="message">{step.preview.text}</pre>}
          {demoMode && <div className="details__note">Демо-режим: в таблицу ничего не запишется.</div>}
          <div className="actions">
            <button className="button" disabled={step.kind === 'saving' || step.preview.note === 'same'} onClick={() => save(step.preview)}>
              {step.kind === 'saving' ? 'Сохраняю…' : '✅ Сменить статус'}
            </button>
            <button className="button button--ghost" disabled={step.kind === 'saving'} onClick={() => setStep({ kind: 'pick' })}>Другой статус</button>
          </div>
        </section>
      )}

      {step.kind === 'error' && (
        <section className="card">
          <div className="state__title">Не получилось</div>
          <div className="details__note">{step.message}</div>
          <div className="actions">
            {step.status && <button className="button" onClick={() => choose(step.status!)}>Повторить</button>}
            <button className="button button--ghost" onClick={() => setStep({ kind: 'pick' })}>К списку статусов</button>
          </div>
        </section>
      )}
    </div>
  );
}

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Неизвестная ошибка. Проверьте интернет и попробуйте ещё раз.';
}

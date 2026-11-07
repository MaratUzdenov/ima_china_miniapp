interface Props {
  status: string | null;
  chain: string[]; // основная цепочка: Принят → … → Доставлен
}

// Полоска по шагам цепочки. «Проблема» и «Отменён» в цепочку не входят — для них полоски нет, только метка.
export function StatusProgress({ status, chain }: Props) {
  const step = status ? chain.indexOf(status) : -1;
  if (step === -1) {
    return <span className="status status--side">{status || 'без статуса'}</span>;
  }
  return (
    <div className="progress" aria-label={`Шаг ${step + 1} из ${chain.length}: ${status}`}>
      <span className={'status' + (step === chain.length - 1 ? ' status--done' : '')}>{status}</span>
      <div className="progress__bar">
        {chain.map((s, i) => (
          <span key={s} className={'progress__seg' + (i <= step ? ' progress__seg--on' : '')} />
        ))}
      </div>
    </div>
  );
}

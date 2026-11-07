// Три состояния экрана: загрузка, пусто, ошибка.

export function SkeletonList() {
  return (
    <div className="list" aria-busy="true" aria-label="Загрузка заказов">
      {[0, 1, 2].map(i => (
        <div key={i} className="card skeleton">
          <div className="skeleton__line skeleton__line--short" />
          <div className="skeleton__line" />
          <div className="skeleton__line skeleton__line--bar" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="state">
      <div className="state__icon">📭</div>
      <div className="state__title">{title}</div>
      <div className="state__hint">{hint}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <div className="state__icon">⚠️</div>
      <div className="state__title">Не получилось загрузить</div>
      <div className="state__hint">{message}</div>
      {onRetry && <button className="button" onClick={onRetry}>Повторить</button>}
    </div>
  );
}

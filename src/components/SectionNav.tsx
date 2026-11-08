export type Section = 'orders' | 'dashboard';

const SECTIONS: { key: Section; title: string }[] = [
  { key: 'orders', title: '📋 Заказы' },
  { key: 'dashboard', title: '📊 Дашборд' },
];

// Переключатель разделов вверху экрана. Показываем только на главных экранах (не в карточке заказа и не в форме).
export function SectionNav({ current, onChange }: { current: Section; onChange: (s: Section) => void }) {
  return (
    <nav className="tabs section-nav" role="tablist" aria-label="Разделы">
      {SECTIONS.map(s => (
        <button key={s.key} role="tab" aria-selected={current === s.key}
          className={'tab' + (current === s.key ? ' tab--on' : '')} onClick={() => onChange(s.key)}>
          {s.title}
        </button>
      ))}
    </nav>
  );
}

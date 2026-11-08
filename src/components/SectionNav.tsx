export type Section = 'orders' | 'dashboard';

const SECTIONS: { key: Section; icon: string; title: string }[] = [
  { key: 'orders', icon: '📋', title: 'Заказы' },
  { key: 'dashboard', icon: '📊', title: 'Дашборд' },
];

// Нижняя панель разделов — как в обычных приложениях: до неё дотягивается большой палец, верх экрана свободен.
// Показываем только на главных экранах; в карточке заказа и в формах её нет (там своя кнопка «Назад»).
export function SectionNav({ current, onChange }: { current: Section; onChange: (s: Section) => void }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Разделы">
      {SECTIONS.map(s => (
        <button key={s.key} role="tab" aria-selected={current === s.key}
          className={'tabbar__item' + (current === s.key ? ' tabbar__item--on' : '')} onClick={() => onChange(s.key)}>
          <span className="tabbar__icon" aria-hidden="true">{s.icon}</span>
          <span className="tabbar__title">{s.title}</span>
        </button>
      ))}
    </nav>
  );
}

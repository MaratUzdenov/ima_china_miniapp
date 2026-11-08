import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Подсказка «?» как на сайтах: всплывает поверх экрана и ничего не сдвигает.
// Открывается и закрывается нажатием на «?», закрывается касанием в любом другом месте и при прокрутке.
// Рисуем в <body> (portal) с position: fixed — иначе её обрезала бы карточка.

const EDGE = 12; // отступ от краёв экрана
const GAP = 8;   // от «?» до подсказки

type Pos = { top: number; left: number; arrow: number; above: boolean };

export function HelpTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  // Считаем место после первой отрисовки (нужен размер подсказки): сверху, если помещается, иначе снизу.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    if (!btn.current || !tip.current) return;
    const b = btn.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const center = b.left + b.width / 2;
    const left = Math.max(EDGE, Math.min(center - t.width / 2, vw - EDGE - t.width));
    const above = b.top - GAP - t.height >= EDGE;
    setPos({ top: above ? b.top - GAP - t.height : b.bottom + GAP, left, arrow: center - left, above });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (btn.current?.contains(e.target as Node)) return; // нажатие на «?» обработает onClick
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button ref={btn} type="button" className={'field__help' + (open ? ' field__help--on' : '')}
        aria-label={'Подсказка: ' + label} aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>?</button>
      {open && createPortal(
        <div ref={tip} role="tooltip" className={'tip' + (pos?.above === false ? ' tip--below' : '')}
          style={pos ? { top: pos.top, left: pos.left, ['--arrow' as string]: pos.arrow + 'px' } : { visibility: 'hidden', top: 0, left: 0 }}>
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}

import { useState, useRef, useEffect, ReactNode } from 'react';
// В установленной версии lucide-react иконка называется HelpCircle
// (CircleHelp появился в более новых релизах) — импортируем с алиасом.
import { HelpCircle as CircleHelp } from 'lucide-react';

interface HintProps {
  /** Текст подсказки (можно JSX) */
  text: ReactNode;
  className?: string;
}

/**
 * Переиспользуемая подсказка: иконка «?» рядом с элементом,
 * всплывающая карточка при hover/focus/click.
 * Закрывается по Esc и клику вне. Без внешних зависимостей.
 */
export function Hint({ text, className }: HintProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex items-center align-middle ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Подсказка"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <CircleHelp className="w-4 h-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 max-w-[80vw] p-3 rounded-lg bg-card border border-border shadow-soft text-left text-sm font-normal leading-snug text-foreground whitespace-normal"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export default Hint;

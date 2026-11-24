import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/** Shared button with variant (primary/secondary/ghost/danger) and size presets. */
export function Button({ variant = 'secondary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-4 py-2.5 text-sm',
        variant === 'primary' && 'bg-accent text-accent-contrast shadow-sm hover:bg-accent-strong',
        variant === 'secondary' && 'bg-surface-high text-text border border-border hover:bg-surface-highest hover:border-border-strong',
        variant === 'ghost' && 'bg-transparent text-text-muted hover:bg-surface-high hover:text-text',
        variant === 'danger' && 'bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

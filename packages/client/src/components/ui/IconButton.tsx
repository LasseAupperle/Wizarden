import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // accessible label (icon-only button)
  children: ReactNode;
}

export function IconButton({ label, className, children, ...rest }: Props) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-ui text-ink',
        'border border-line bg-elevated hover:border-accent active:scale-95 transition touch-manipulation',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

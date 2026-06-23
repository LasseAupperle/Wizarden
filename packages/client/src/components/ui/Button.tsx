import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong active:scale-[0.98]',
  secondary: 'border border-line bg-elevated text-ink hover:border-accent active:scale-[0.98]',
  ghost: 'text-muted hover:text-ink hover:bg-elevated active:scale-[0.98]',
  destructive: 'bg-negative text-white hover:opacity-90 active:scale-[0.98]',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-4 text-sm',
  lg: 'h-14 px-6 text-base',
};

export function Button({ variant = 'primary', size = 'md', fullWidth, className, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-ui font-semibold transition select-none',
        'disabled:opacity-40 disabled:pointer-events-none touch-manipulation',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}

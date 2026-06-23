import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn.js';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 'center' = Modal, 'bottom' = Sheet. */
  placement?: 'center' | 'bottom';
  labelledBy?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/** Accessible overlay base: focus trap, Escape + backdrop close, focus restore. */
export function Overlay({ open, onClose, children, placement = 'center', labelledBy }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal to <body> so the overlay escapes any ancestor that establishes a
  // containing block (e.g. the TopBar's backdrop-filter), which would otherwise
  // pin `position: fixed` to the bar instead of the viewport.
  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm',
        placement === 'center'
          ? 'items-center justify-center p-4'
          : 'items-end justify-center',
        'pt-[env(safe-area-inset-top)]',
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          'bg-surface text-ink outline-none',
          placement === 'center'
            ? 'w-full max-w-md rounded-ui border border-line shadow-card max-h-[85vh] overflow-y-auto'
            : 'w-full max-w-md rounded-t-2xl border-t border-line shadow-sheet max-h-[88vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

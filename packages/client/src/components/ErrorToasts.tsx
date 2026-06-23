import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore.js';

/** Transient error/info toasts (§15). Auto-dismiss after a few seconds. */
export function ErrorToasts() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((tst) => setTimeout(() => dismiss(tst.id), 3200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((tst) => (
        <div
          key={tst.id}
          role="alert"
          className="pointer-events-auto max-w-sm rounded-ui border border-line bg-elevated px-4 py-2 text-sm text-ink shadow-card"
        >
          {tst.text}
        </div>
      ))}
    </div>
  );
}

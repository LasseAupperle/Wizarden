/** Shown only in landscape on short screens — Wizarden is portrait-first (§19). */
export function RotateHint() {
  return (
    <div className="rotate-hint fixed inset-0 z-[80] flex-col items-center justify-center gap-3 bg-bg p-8 text-center text-ink">
      <div className="text-5xl" aria-hidden>
        📱↻
      </div>
      <p className="font-display text-lg">Please rotate to portrait</p>
      <p className="text-sm text-muted">Wizarden is designed to be played upright.</p>
    </div>
  );
}

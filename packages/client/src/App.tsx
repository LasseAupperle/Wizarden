import { BASE_DECK_SIZE } from '@wizarden/shared';

export default function App() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-[#1a1033] text-white p-6 text-center select-none">
      <h1 className="text-5xl font-black tracking-tight">Wizarden</h1>
      <p className="mt-3 text-white/70">Wizard — 30-Year Edition</p>
      <p className="mt-8 text-xs text-white/40">
        scaffold ok · base deck {BASE_DECK_SIZE} cards
      </p>
    </main>
  );
}

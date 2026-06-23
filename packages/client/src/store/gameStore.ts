// Single UI source of truth: a Zustand store that mirrors the server's
// ClientGameState plus connection status, transient toasts, and local settings.

import { create } from 'zustand';
import type { ClientGameState, PendingDecision } from '@wizarden/shared';
import { storage, type Settings } from '../lib/storage.js';

export type ConnectionStatus =
  | 'connecting'
  | 'waking' // Render free-tier cold start (§17)
  | 'connected'
  | 'reconnecting'
  | 'sessionEnded';

export type Screen = 'landing' | 'lobby' | 'game' | 'gameover';

export interface Toast {
  id: number;
  text: string;
}

export interface GameStore {
  connection: ConnectionStatus;
  game: ClientGameState | null;
  pendingDecision: PendingDecision | null;
  toasts: Toast[];
  banner: string | null; // explanatory line on Landing after a fatal/session end
  settings: Settings;

  setConnection: (c: ConnectionStatus) => void;
  setGame: (s: ClientGameState) => void;
  setPendingDecision: (d: PendingDecision | null) => void;
  pushToast: (text: string) => void;
  dismissToast: (id: number) => void;
  setBanner: (text: string | null) => void;
  resetToLanding: (banner?: string) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

let toastId = 0;

export const useGameStore = create<GameStore>((set) => ({
  connection: 'connecting',
  game: null,
  pendingDecision: null,
  toasts: [],
  banner: null,
  settings: storage.getSettings(),

  setConnection: (c) => set({ connection: c }),
  setGame: (s) => set({ game: s, pendingDecision: s.pendingDecision }),
  setPendingDecision: (d) => set({ pendingDecision: d }),
  pushToast: (text) => set((st) => ({ toasts: [...st.toasts, { id: ++toastId, text }] })),
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  setBanner: (text) => set({ banner: text }),
  resetToLanding: (banner) =>
    set({ game: null, pendingDecision: null, banner: banner ?? null, connection: 'connected' }),
  setSetting: (key, value) =>
    set((st) => {
      const settings = { ...st.settings, [key]: value };
      storage.setSettings(settings);
      return { settings };
    }),
}));

export function selectScreen(game: ClientGameState | null): Screen {
  if (!game) return 'landing';
  if (game.phase === 'lobby') return 'lobby';
  if (game.phase === 'gameOver') return 'gameover';
  return 'game';
}

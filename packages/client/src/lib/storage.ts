// Typed localStorage owner (spec §18). The ONLY module that touches browser
// storage. All access is try/caught so storage failures degrade gracefully
// (the app still works, just without persistence).

import type { Locale, ThemeMode } from '@wizarden/shared';

export interface SessionInfo {
  token: string;
  roomCode: string;
}

export interface Settings {
  sound: boolean;
  animations: boolean;
  theme: ThemeMode;
  language: Locale;
}

const KEYS = {
  session: 'wizarden.session',
  name: 'wizarden.name',
  settings: 'wizarden.settings',
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const storage = {
  getSession: (): SessionInfo | null => read<SessionInfo>(KEYS.session),
  setSession: (s: SessionInfo): void => write(KEYS.session, s),
  clearSession: (): void => remove(KEYS.session),

  getName: (): string => {
    try {
      return localStorage.getItem(KEYS.name) ?? '';
    } catch {
      return '';
    }
  },
  setName: (name: string): void => {
    try {
      localStorage.setItem(KEYS.name, name);
    } catch {
      /* ignore */
    }
  },

  getSettings: (): Settings => {
    const def: Settings = { sound: true, animations: true, theme: 'dark', language: 'en' };
    return { ...def, ...(read<Partial<Settings>>(KEYS.settings) ?? {}) };
  },
  setSettings: (s: Settings): void => write(KEYS.settings, s),
};

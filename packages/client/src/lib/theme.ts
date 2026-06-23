// Applies theme + language settings to the document root. Components read tokens,
// so flipping data-theme restyles the whole app with no per-component changes.

import type { Locale, ThemeMode } from '@wizarden/shared';

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function applyLanguage(language: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
}

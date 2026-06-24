import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts (no Google CDN request) — only the weights we use.
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import App from './App.js';
import { storage } from './lib/storage.js';
import { applyAnimations, applyLanguage, applyTheme } from './lib/theme.js';
import { initSentry } from './lib/sentry.js';
import './styles/index.css';

// Apply persisted theme/language/animations before first paint (avoid a flash).
const settings = storage.getSettings();
applyTheme(settings.theme);
applyLanguage(settings.language);
applyAnimations(settings.animations);

// Optional error tracking (no-op unless VITE_SENTRY_DSN is configured).
void initSentry();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

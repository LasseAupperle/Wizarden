import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import { storage } from './lib/storage.js';
import { applyLanguage, applyTheme } from './lib/theme.js';
import './styles/index.css';

// Apply persisted theme/language before first paint (avoid a flash).
const settings = storage.getSettings();
applyTheme(settings.theme);
applyLanguage(settings.language);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

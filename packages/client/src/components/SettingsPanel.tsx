import type { ReactNode } from 'react';
import { LOCALES, type Locale, type ThemeMode } from '@wizarden/shared';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../lib/i18n.js';
import { applyAnimations, applyLanguage, applyTheme } from '../lib/theme.js';
import { cn } from '../lib/cn.js';

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-7 w-12 rounded-full border transition',
        on ? 'bg-accent border-accent' : 'bg-elevated border-line',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
          on ? 'left-6' : 'left-0.5',
        )}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-ui border border-line bg-elevated p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition',
            value === o.value ? 'bg-accent text-white' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const LANG_LABELS: Record<Locale, string> = { en: 'EN', nl: 'NL', de: 'DE' };

export function SettingsPanel() {
  const t = useT();
  const settings = useGameStore((s) => s.settings);
  const setSetting = useGameStore((s) => s.setSetting);

  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-ink">{label}</span>
      {children}
    </div>
  );

  return (
    <div className="divide-y divide-line">
      <Row label={t('sound')}>
        <Toggle on={settings.sound} onChange={(v) => setSetting('sound', v)} label={t('sound')} />
      </Row>
      <Row label={t('animations')}>
        <Toggle
          on={settings.animations}
          onChange={(v) => {
            setSetting('animations', v);
            applyAnimations(v);
          }}
          label={t('animations')}
        />
      </Row>
      <Row label={t('theme')}>
        <Segmented<ThemeMode>
          label={t('theme')}
          value={settings.theme}
          onChange={(v) => {
            setSetting('theme', v);
            applyTheme(v);
          }}
          options={[
            { value: 'dark', label: t('dark') },
            { value: 'light', label: t('light') },
          ]}
        />
      </Row>
      <Row label={t('language')}>
        <Segmented<Locale>
          label={t('language')}
          value={settings.language}
          onChange={(v) => {
            setSetting('language', v);
            applyLanguage(v);
          }}
          options={LOCALES.map((l) => ({ value: l, label: LANG_LABELS[l] }))}
        />
      </Row>
    </div>
  );
}

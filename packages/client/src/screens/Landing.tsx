import { useState } from 'react';
import { TopBar } from '../components/TopBar.js';
import { Button } from '../components/ui/Button.js';
import { Banner } from '../components/ui/Banner.js';
import { Modal } from '../components/ui/Modal.js';
import { HowToPlay } from '../components/HowToPlay.js';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../lib/i18n.js';
import { storage } from '../lib/storage.js';
import { intents } from '../net/socket.js';

const inputCls =
  'w-full rounded-ui border border-line bg-elevated px-4 py-3 text-ink placeholder:text-muted outline-none focus:border-accent';

function initialCode(): string {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('room') ?? '').toUpperCase();
}

export function Landing() {
  const t = useT();
  const banner = useGameStore((s) => s.banner);
  const [name, setName] = useState(storage.getName());
  const [code, setCode] = useState(initialCode);
  const [howto, setHowto] = useState(false);

  const cleanName = () => name.trim().slice(0, 20) || 'Player';
  const create = () => {
    storage.setName(name.trim());
    intents.createRoom(cleanName());
  };
  const join = () => {
    if (!code.trim()) return;
    storage.setName(name.trim());
    intents.joinRoom(cleanName(), code.trim().toUpperCase());
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar center="" />
      {banner && <Banner tone="danger">{banner}</Banner>}

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight text-ink">Wizarden</h1>
          <p className="mt-2 text-muted">{t('tagline')}</p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t('yourName')}</span>
          <input
            className={inputCls}
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player"
            aria-label={t('yourName')}
          />
        </label>

        <Button size="lg" fullWidth onClick={create}>
          {t('createRoom')}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          {t('roomCode')}
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex gap-2">
          <input
            className={`${inputCls} text-center uppercase tracking-widest`}
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            aria-label={t('roomCode')}
          />
          <Button size="lg" variant="secondary" onClick={join} disabled={!code.trim()}>
            {t('joinRoom')}
          </Button>
        </div>

        <button className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => setHowto(true)}>
          {t('howToPlay')}
        </button>
      </main>

      <Modal open={howto} onClose={() => setHowto(false)} title={t('howToPlay')}>
        <HowToPlay />
      </Modal>
    </div>
  );
}

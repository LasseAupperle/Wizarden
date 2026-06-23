import { Banner } from './ui/Banner.js';
import { Button } from './ui/Button.js';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../lib/i18n.js';
import { getSocket } from '../net/socket.js';

/** Drives connection + pause states into a single banner (§15/§17). */
export function ConnectionBanner() {
  const t = useT();
  const connection = useGameStore((s) => s.connection);
  const game = useGameStore((s) => s.game);

  if (game?.paused) {
    return (
      <Banner tone="warn">
        ⏸ {t('pausedFor')} {game.pausedForName ?? '…'}
      </Banner>
    );
  }

  if (connection === 'connected') return null;

  if (connection === 'waking') {
    return (
      <Banner
        tone="warn"
        action={
          <Button size="md" variant="ghost" onClick={() => getSocket().connect()}>
            {t('retry')}
          </Button>
        }
      >
        ☕ {t('wakingServer')}
      </Banner>
    );
  }

  const text = connection === 'reconnecting' ? t('reconnecting') : t('connecting');
  return <Banner tone="info">{text}</Banner>;
}

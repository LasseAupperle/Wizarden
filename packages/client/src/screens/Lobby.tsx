import { useState } from 'react';
import { roundsForPlayerCount, type ClientGameState } from '@wizarden/shared';
import { TopBar } from '../components/TopBar.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { IconButton } from '../components/ui/IconButton.js';
import { SpecialCardPicker } from '../components/SpecialCardPicker.js';
import { GameModePicker } from '../components/GameModePicker.js';
import { useT } from '../lib/i18n.js';
import { toggleSpecial } from '../lib/specials.js';
import { intents, DEBUG_ENABLED } from '../net/socket.js';

function fullRoundsFor(count: number): number {
  if (count >= 3 && count <= 6) return roundsForPlayerCount(count);
  return Math.max(1, Math.round(60 / Math.max(count, 2)));
}

export function Lobby({ game }: { game: ClientGameState }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const you = game.players.find((p) => p.seat === game.yourSeat);
  const isHost = you?.isHost ?? false;
  const count = game.players.length;
  const min = DEBUG_ENABLED ? 2 : 3;
  const canStart = isHost && count >= min && count <= 6;

  const invite = async () => {
    const link = `${window.location.origin}?room=${game.roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard may be blocked */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        center={
          <span className="font-mono tracking-widest" aria-label={t('roomCode')}>
            {game.roomCode}
          </span>
        }
        right={
          <Button size="md" variant="secondary" onClick={invite}>
            {copied ? t('linkCopied') : `🔗 ${t('invite')}`}
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-md flex-1 space-y-5 p-4">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('players')} ({count}/6)
          </h2>
          <ul className="space-y-2">
            {game.players.map((p) => (
              <li
                key={p.seat}
                className="flex items-center justify-between rounded-ui border border-line bg-elevated px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${p.connected ? 'bg-positive' : 'bg-muted'}`}
                    aria-hidden
                  />
                  <span className="font-medium text-ink">{p.name}</span>
                  {p.seat === game.yourSeat && <Badge tone="accent">{t('you')}</Badge>}
                  {p.isHost && <Badge tone="gold">{t('host')}</Badge>}
                  {p.isBot && <Badge>BOT</Badge>}
                </span>
                {isHost && p.seat !== game.yourSeat && (
                  <IconButton
                    label={`Remove ${p.name}`}
                    onClick={() => intents.removePlayer(p.seat)}
                  >
                    ✕
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('gameMode')}
          </h2>
          <GameModePicker
            mode={game.gameMode}
            fullRounds={fullRoundsFor(count)}
            disabled={!isHost}
            onChange={(m) => intents.configureMode(m)}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('specials')}
          </h2>
          <SpecialCardPicker
            selected={game.selectedSpecials}
            disabled={!isHost}
            onToggle={(type) =>
              intents.configureSpecials(toggleSpecial(game.selectedSpecials, type))
            }
          />
        </section>

        {DEBUG_ENABLED && isHost && count < 6 && (
          <Button variant="secondary" fullWidth onClick={() => intents.addBot()}>
            🤖 {t('addBot')}
          </Button>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-line bg-bg/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        {isHost ? (
          <Button size="lg" fullWidth disabled={!canStart} onClick={() => intents.start()}>
            {canStart ? t('startGame') : t('needMorePlayers')}
          </Button>
        ) : (
          <p className="text-center text-muted">{t('waitingForHost')}</p>
        )}
      </footer>
    </div>
  );
}

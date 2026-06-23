import type { ClientGameState } from '@wizarden/shared';
import { TopBar } from '../components/TopBar.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { useT } from '../lib/i18n.js';
import { intents } from '../net/socket.js';

export function GameOver({ game }: { game: ClientGameState }) {
  const t = useT();
  const standings = game.gameOver?.standings ?? [];
  const top = standings[0]?.totalScore ?? 0;
  const winners = standings.filter((p) => p.totalScore === top);
  const you = game.players.find((p) => p.seat === game.yourSeat);
  const isHost = you?.isHost ?? false;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar center={t('gameOver')} />
      <main className="mx-auto w-full max-w-md flex-1 space-y-5 p-6">
        <div className="text-center">
          <div className="text-5xl" aria-hidden>
            🏆
          </div>
          <h1 className="mt-2 font-display text-2xl text-ink">
            {winners.length > 1 ? t('winners') : t('winner')}: {winners.map((w) => w.name).join(', ')}
          </h1>
        </div>

        <ol className="space-y-2">
          {standings.map((p, i) => (
            <li
              key={p.seat}
              className="flex items-center justify-between rounded-ui border border-line bg-elevated px-4 py-2"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-muted">{i + 1}.</span>
                <span className="font-semibold text-ink">{p.name}</span>
                {!p.inPlay && <span className="text-xs text-muted">(left)</span>}
                {p.seat === game.yourSeat && <Badge tone="accent">{t('you')}</Badge>}
              </span>
              <Badge tone="gold">{p.totalScore}</Badge>
            </li>
          ))}
        </ol>
      </main>

      <footer className="sticky bottom-0 space-y-2 border-t border-line bg-bg/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        {isHost && (
          <Button size="lg" fullWidth onClick={() => intents.playAgain()}>
            {t('playAgain')}
          </Button>
        )}
        <Button size="lg" variant="secondary" fullWidth onClick={() => intents.leave()}>
          {t('backToStart')}
        </Button>
      </footer>
    </div>
  );
}

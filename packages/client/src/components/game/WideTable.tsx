import type { ClientGameState } from '@wizarden/shared';
import { CardView } from '../CardView.js';
import { PlayerChip } from './PlayerChip.js';
import { TrumpWidget } from './TrumpWidget.js';
import { TrickCaption } from './TrickCaption.js';
import { RoundSummary } from './RoundSummary.js';
import { playOrderFromYou } from './helpers.js';

/** Position on an ellipse: angle 90° = bottom centre (you), increasing clockwise. */
function at(angleDeg: number, rx: number, ry: number): { left: string; top: string } {
  const a = (angleDeg * Math.PI) / 180;
  return { left: `${50 + rx * Math.cos(a)}%`, top: `${50 + ry * Math.sin(a)}%` };
}

/**
 * PC game table: players sit around an oval in play order (you at the bottom,
 * the next player to your left, clockwise), each card played lands in front of
 * its player, and the trump card sits in the middle. A finished trick stays
 * with the winner highlighted; the round summary appears in the centre.
 */
export function WideTable({
  game,
  showSummary,
  countdown,
}: {
  game: ClientGameState;
  showSummary: boolean;
  countdown: number;
}) {
  const order = playOrderFromYou(game);
  const n = order.length;
  const held = game.lastTrick;
  const plays = held ? held.plays : game.currentTrick;
  const playBySeat = new Map(plays.map((p) => [p.seat, p]));

  return (
    <div className="relative h-full min-h-[22rem] w-full">
      {/* the felt */}
      <div
        className="absolute inset-x-[9%] inset-y-[12%] rounded-[50%] border-2 border-[var(--table-edge)] shadow-[inset_0_0_60px_rgba(0,0,0,0.25)]"
        style={{
          background: 'radial-gradient(closest-side, var(--table-from), var(--table-to))',
        }}
        aria-hidden
      />

      {/* seats + the card each player put in */}
      {order.map((p, i) => {
        const angle = 90 + (i * 360) / n;
        const seatPos = at(angle, 44, 44);
        const cardPos = at(angle, 26, 28);
        const play = playBySeat.get(p.seat);
        const isYou = p.seat === game.yourSeat;
        return (
          <div key={p.seat}>
            {!isYou && (
              <div className="absolute w-36 -translate-x-1/2 -translate-y-1/2" style={seatPos}>
                <PlayerChip game={game} player={p} large />
              </div>
            )}
            {play && (
              <div
                className="animate-card-in absolute -translate-x-1/2 -translate-y-1/2"
                style={cardPos}
              >
                <CardView card={play.card} size="md" winner={held?.winnerSeat === p.seat} />
              </div>
            )}
          </div>
        );
      })}

      {/* centre: the trump card, or the round summary at round end */}
      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        {showSummary ? (
          <RoundSummary game={game} countdown={countdown} />
        ) : (
          <TrumpWidget game={game} />
        )}
      </div>

      {/* who won the trick that just finished — below your card, clear of the cards */}
      <div className="absolute left-1/2 top-[94%] z-10 -translate-x-1/2 -translate-y-1/2">
        <TrickCaption game={game} />
      </div>
    </div>
  );
}

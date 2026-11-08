import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUND_SUMMARY_MS, type Card, type ClientGameState } from '@wizarden/shared';
import { ChartColumn } from 'lucide-react';
import { TopBar } from '../components/TopBar.js';
import { IconButton } from '../components/ui/IconButton.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { Hand } from '../components/game/Hand.js';
import { BidPicker } from '../components/game/BidPicker.js';
import { ActionPanel } from '../components/game/ActionPanel.js';
import { TrickArea } from '../components/game/TrickArea.js';
import { TrumpWidget } from '../components/game/TrumpWidget.js';
import { RoundSummary } from '../components/game/RoundSummary.js';
import { ScoreTable } from '../components/game/ScoreTable.js';
import { WideTable } from '../components/game/WideTable.js';
import { PlayerChip, YourStatus } from '../components/game/PlayerChip.js';
import { useCoarsePointer, useIsWide } from '../components/game/useMedia.js';
import {
  bidsSoFar,
  isPlayable,
  nameOf,
  playOrderFromYou,
  sortHand,
} from '../components/game/helpers.js';
import { intents } from '../net/socket.js';
import { playPlaceCard } from '../sound/placeCard.js';
import { useT } from '../lib/i18n.js';

/** What tapping a hand card does right now. */
type HandMode = 'play' | 'pass' | 'give' | 'none';

/** Specials that need a choice (Wizard/Jester, or a colour) before they're played. */
const needsAnnounce = (c: Card) =>
  c.kind === 'special' &&
  (c.special === 'shapeshifter' || c.special === 'juggler' || c.special === 'cloud');

export function Game({ game }: { game: ClientGameState }) {
  const t = useT();
  const wide = useIsWide();
  const coarse = useCoarsePointer();
  const [scoreOpen, setScoreOpen] = useState(false);
  const [announceCard, setAnnounceCard] = useState<Card | null>(null);
  const [witchTake, setWitchTake] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bidValue, setBidValue] = useState(0);

  const held = game.lastTrick;
  const decision = game.pendingDecision;
  const yourTurnToPlay =
    game.phase === 'trick' && game.currentTurnSeat === game.yourSeat && !held && !announceCard;
  const yourTurnToBid =
    game.phase === 'bidding' && game.currentTurnSeat === game.yourSeat && !decision;
  const showSummary = game.phase === 'roundEnd' && !held && !!game.lastRoundResult;
  const hand = useMemo(() => sortHand(game.yourHand), [game.yourHand]);

  const handMode: HandMode =
    decision?.kind === 'jugglerPass'
      ? 'pass'
      : decision?.kind === 'witchSwap' && witchTake
        ? 'give'
        : yourTurnToPlay
          ? 'play'
          : 'none';

  const enabled = useCallback(
    (card: Card) =>
      handMode === 'play'
        ? isPlayable(card, game.yourHand, game.currentTrick)
        : handMode !== 'none',
    [handMode, game.yourHand, game.currentTrick],
  );

  // Reset transient choices when the situation changes.
  useEffect(() => setSelectedId(null), [handMode, game.yourHand.length]);
  useEffect(() => setBidValue(0), [game.roundNumber]);
  useEffect(() => {
    if (decision?.kind !== 'witchSwap') setWitchTake(null);
  }, [decision?.kind]);

  // Place-card sound whenever a card lands on the table (yours or others').
  const onTable = held ? held.plays.length : game.currentTrick.length;
  const prevOnTable = useRef(onTable);
  useEffect(() => {
    if (onTable > prevOnTable.current) playPlaceCard();
    prevOnTable.current = onTable;
  }, [onTable]);

  // Round-end countdown to the automatic next round (starts when the summary shows).
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!showSummary) return;
    setCountdown(Math.ceil(ROUND_SUMMARY_MS / 1000));
    const id = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [showSummary, game.roundNumber]);

  /** Do the hand action for a card (play / pass / give). */
  const perform = useCallback(
    (card: Card) => {
      setSelectedId(null);
      if (handMode === 'play') {
        if (needsAnnounce(card)) return setAnnounceCard(card);
        playPlaceCard();
        intents.play(card.id, { type: 'none' });
      } else if (handMode === 'pass') {
        intents.resolve({ cardId: card.id });
      } else if (handMode === 'give' && witchTake) {
        intents.resolve({ takeId: witchTake, giveId: card.id });
        setWitchTake(null);
      }
    },
    [handMode, witchTake],
  );

  /** Touch: first tap lifts the card, second tap plays it. Mouse: click plays. */
  const activate = (card: Card) => {
    if (!enabled(card) || handMode === 'none') return;
    if (coarse && selectedId !== card.id) return setSelectedId(card.id);
    perform(card);
  };

  // Keyboard play (PC): ← → choose a card, Enter plays; while bidding type a
  // number (or ↑ ↓) and press Enter.
  const digits = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (yourTurnToBid) {
        const max = game.roundNumber;
        if (/^[0-9]$/.test(e.key)) {
          const now = Date.now();
          const text = now - digits.current.at < 900 ? digits.current.text + e.key : e.key;
          digits.current = { text, at: now };
          setBidValue(Math.min(max, Number(text)));
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          setBidValue((v) => Math.min(max, v + 1));
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setBidValue((v) => Math.max(0, v - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          intents.bid(bidValue);
        }
        return;
      }
      if (handMode === 'none') return;
      const choices = hand.filter(enabled);
      if (choices.length === 0) return;
      const idx = choices.findIndex((c) => c.id === selectedId);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const d = e.key === 'ArrowRight' ? 1 : -1;
        const next =
          idx < 0 ? (d > 0 ? 0 : choices.length - 1) : (idx + d + choices.length) % choices.length;
        setSelectedId(choices[next]!.id);
      } else if ((e.key === 'Enter' || e.key === ' ') && idx >= 0) {
        // Only when a card is selected, so Enter on a focused button still works.
        if (document.activeElement?.tagName === 'BUTTON' && e.key === ' ') return;
        e.preventDefault();
        perform(choices[idx]!);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [yourTurnToBid, bidValue, game.roundNumber, handMode, hand, enabled, selectedId, perform]);

  // Screen-reader announcements (§19).
  const announce = useMemo(() => {
    if (game.paused) return `${t('pausedFor')} ${game.pausedForName ?? ''}`;
    if (held) {
      return held.winnerSeat == null
        ? t('noOneWins')
        : held.winnerSeat === game.yourSeat
          ? t('youWinTrick')
          : t('winsTrick', { name: nameOf(game, held.winnerSeat) });
    }
    if (decision) return t('yourDecision');
    if (yourTurnToBid) return `${t('yourBid')} — ${t('yourTurn')}`;
    if (yourTurnToPlay) return t('yourTurn');
    if (showSummary) return t('roundN', { n: game.roundNumber });
    return '';
  }, [game, held, decision, yourTurnToBid, yourTurnToPlay, showSummary, t]);

  const hint =
    coarse && selectedId
      ? t('tapAgainToPlay')
      : wide && handMode !== 'none'
        ? t('keyboardHint')
        : null;

  const actions = (
    <>
      {yourTurnToBid && (
        <BidPicker
          cards={game.roundNumber}
          bidsSoFar={bidsSoFar(game)}
          value={bidValue}
          onChange={setBidValue}
          onBid={(n) => intents.bid(n)}
          showKeyHint={wide}
        />
      )}
      <ActionPanel
        game={game}
        announceCard={announceCard}
        onCancelAnnounce={() => setAnnounceCard(null)}
        witchTake={witchTake}
        setWitchTake={setWitchTake}
      />
    </>
  );
  const handView = (
    <Hand
      cards={hand}
      size={wide ? 'lg' : 'md'}
      enabled={enabled}
      interactive={handMode !== 'none'}
      selectedId={selectedId}
      onActivate={activate}
      maxRows={2}
    />
  );
  const status = (
    <div className="sr-only" role="status" aria-live="polite">
      {announce}
    </div>
  );
  const roundLabel = t('roundOf', { n: game.roundNumber, total: game.totalRounds });

  if (wide) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar center={<span className="text-base">{roundLabel}</span>} />
        {status}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 p-3">
              <WideTable game={game} showSummary={showSummary} countdown={countdown} />
            </div>
            <div className="space-y-2 border-t border-line p-3">
              <YourStatus game={game} hint={hint} />
              <div className="mx-auto max-w-2xl space-y-2">{actions}</div>
              <div className="mx-auto max-w-5xl pt-3">{handView}</div>
            </div>
          </div>
          <aside className="min-h-0 overflow-y-auto border-l border-line p-4">
            <h2 className="mb-3 font-display text-lg text-ink">{t('scoreboard')}</h2>
            <ScoreTable game={game} compact />
          </aside>
        </div>
      </div>
    );
  }

  const opponents = playOrderFromYou(game).slice(1);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        center={<span className="text-sm">{roundLabel}</span>}
        right={
          <IconButton label={t('scoreboard')} onClick={() => setScoreOpen(true)}>
            <ChartColumn size={20} aria-hidden />
          </IconButton>
        }
      />
      {status}

      {/* opponents, in play order after you (left → right) */}
      <div className="flex flex-wrap justify-center gap-1.5 px-2 pt-2">
        {opponents.map((p) => (
          <div
            key={p.seat}
            className={opponents.length > 3 ? 'w-[calc(33.333%-0.25rem)]' : 'min-w-0 flex-1'}
          >
            <PlayerChip game={game} player={p} />
          </div>
        ))}
      </div>

      {/* the table */}
      <div className="flex min-h-0 flex-1 items-center gap-1 overflow-y-auto bg-[radial-gradient(60%_45%_at_50%_45%,var(--table-from),transparent_75%)] px-2 py-2">
        {showSummary ? (
          <div className="flex w-full justify-center">
            <RoundSummary game={game} countdown={countdown} />
          </div>
        ) : (
          <>
            <TrumpWidget game={game} className="w-14 shrink-0 self-start" />
            <div className="flex min-w-0 flex-1 justify-center">
              <TrickArea game={game} />
            </div>
            <div className="w-14 shrink-0" aria-hidden />
          </>
        )}
      </div>

      {/* you: status, choices, hand — always visible */}
      <div className="space-y-2 border-t border-line px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        <YourStatus game={game} hint={hint} />
        {actions}
        <div className="pt-3">{handView}</div>
      </div>

      <Scoreboard game={game} open={scoreOpen} onClose={() => setScoreOpen(false)} />
    </div>
  );
}

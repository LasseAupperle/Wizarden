// Complete in-app rulebook (§23.1). Original paraphrase of the 30-Year Edition
// rules — no AMIGO artwork or verbatim text. Rendered inside a scrollable Modal.

import { ALL_SPECIALS, SPECIAL_META } from '../lib/specials.js';

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-1.5 font-display text-base text-ink first:mt-0">{children}</h3>;
}

export function FullRules() {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      <H>Overview</H>
      <p>
        Wizard is a trick-prediction game for 3–6 players. Every round you predict exactly how many
        tricks you'll take, then try to hit that number. You play a fixed number of rounds (60 ÷
        players: 20 for three, 15 for four, 12 for five, 10 for six), each round dealing one more
        card than the last. Most experience points at the end wins; ties share the win.
      </p>

      <H>The deck</H>
      <p>
        60 character cards: four colours numbered 1–13, four Wizards (the strongest — beat
        everything), and four Jesters (the weakest — lose to everything). Wizards and Jesters belong
        to no colour and may be played at any time. The extended game adds up to nine special cards.
      </p>

      <H>Dealing &amp; trump</H>
      <p>
        Shuffle and deal the round's cards to each player; the rest form a face-down pile. Flip its
        top card — its colour is trump for the round. If a Wizard is flipped, the dealer chooses the
        trump colour; if a Jester is flipped, there is no trump. In the base game the final round has
        no trump (all cards are dealt); with specials there are enough extra cards that the last
        round still flips one.
      </p>

      <H>Predicting</H>
      <p>
        Starting clockwise of the dealer, each player announces how many tricks they expect to win.
        Predictions are public and need <em>not</em> add up to the number of tricks available —
        everyone could aim high, or someone could bid zero.
      </p>

      <H>Playing tricks</H>
      <p>
        The first predictor leads the first trick. You must follow the led colour if you can;
        otherwise play anything (a trump or off-colour). Wizards and Jesters may always be played.
        The trick is won by the first Wizard played; if none, the highest trump; if no trump either,
        the highest card of the colour that was led. If a Jester leads, the colour is only set once a
        number card is played; if only Jesters are played, the first Jester wins. The winner leads
        the next trick.
      </p>

      <H>Scoring</H>
      <p>
        <strong className="text-positive">Correct prediction:</strong> 20 points plus 10 for each
        trick you predicted (a correct bid of 0 scores 20).{' '}
        <strong className="text-negative">Wrong prediction:</strong> you lose 10 points for every
        trick you were over or under. Tricks set aside by a Bomb count for no one.
      </p>

      <H>The special cards</H>
      <ul className="space-y-2">
        {ALL_SPECIALS.map((type) => {
          const m = SPECIAL_META[type];
          return (
            <li key={type} className="rounded-ui border border-line bg-elevated p-2.5">
              <span className="mr-1.5" aria-hidden>
                {m.emblem}
              </span>
              <span className="font-semibold text-ink">{m.name}</span>
              <span className="ml-1">— {m.rule}</span>
            </li>
          );
        })}
      </ul>
      <p className="pt-1 text-xs">
        Dragon and Fairy are always added together. The Shapeshifter is the gentlest one to start
        with. When several specials land in one trick they resolve in a fixed order: Bomb, then
        Juggler, then Cloud, then Witch.
      </p>

      <H>Leaving mid-game</H>
      <p>
        If a player leaves and three or more remain, the current round is re-dealt to the rest and
        the game continues to its original length. If fewer than three remain, the game ends with
        the standings so far.
      </p>
    </div>
  );
}

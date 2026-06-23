import { ALL_SPECIALS, SPECIAL_META } from '../lib/specials.js';

/** Quick reference (§13). Original summary — flow, scoring, and the 9 specials. */
export function HowToPlay() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted">
      <section>
        <h3 className="mb-1 font-display text-base text-ink">The goal</h3>
        <p>
          Each round you predict exactly how many tricks you'll win. You only score well when your
          prediction is spot on. The most experience points after the final round wins.
        </p>
      </section>
      <section>
        <h3 className="mb-1 font-display text-base text-ink">A round</h3>
        <p>
          Deal one more card each round. The top undealt card sets the trump colour. Predict your
          tricks (clockwise of the dealer first), then play tricks: follow the led colour if you can;
          Wizards and Jesters may always be played. Highest Wizard wins, else highest trump, else
          highest card of the led colour.
        </p>
      </section>
      <section>
        <h3 className="mb-1 font-display text-base text-ink">Scoring</h3>
        <p>
          Correct prediction: <span className="text-positive">20 + 10 × your bid</span> (a correct 0
          scores 20). Wrong: <span className="text-negative">−10 for every trick over or under</span>.
        </p>
      </section>
      <section>
        <h3 className="mb-2 font-display text-base text-ink">Special cards</h3>
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
      </section>
    </div>
  );
}

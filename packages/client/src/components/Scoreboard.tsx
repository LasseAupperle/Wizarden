import type { ClientGameState } from '@wizarden/shared';
import { Modal } from './ui/Modal.js';
import { ScoreTable } from './game/ScoreTable.js';
import { useT } from '../lib/i18n.js';

/** Always-available scoreboard popup (§6.2): per-round points + bids, totals. */
export function Scoreboard({
  game,
  open,
  onClose,
}: {
  game: ClientGameState;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={t('scoreboard')}>
      <ScoreTable game={game} />
    </Modal>
  );
}

import { Modal } from './ui/Modal.js';
import { Button } from './ui/Button.js';
import { useT } from '../lib/i18n.js';

interface Props {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Reusable confirm modal for destructive/irreversible actions (§13). */
export function ConfirmDialog({ open, title, body, confirmLabel, destructive, onConfirm, onCancel }: Props) {
  const t = useT();
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {body && <p className="text-muted">{body}</p>}
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} fullWidth onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

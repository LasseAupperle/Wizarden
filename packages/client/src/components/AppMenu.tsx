import { useState } from 'react';
import { IconButton } from './ui/IconButton.js';
import { Button } from './ui/Button.js';
import { Modal, Sheet } from './ui/Modal.js';
import { SettingsPanel } from './SettingsPanel.js';
import { HowToPlay } from './HowToPlay.js';
import { FullRules } from './FullRules.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../lib/i18n.js';
import { intents } from '../net/socket.js';

type View = null | 'settings' | 'howto' | 'rules';

/** Always-available app menu (§13): settings, how-to-play, full rules, leave. */
export function AppMenu() {
  const t = useT();
  const inRoom = useGameStore((s) => s.game !== null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<View>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const open = (v: View) => {
    setMenuOpen(false);
    setView(v);
  };

  return (
    <>
      <IconButton label={t('menu')} onClick={() => setMenuOpen(true)}>
        ☰
      </IconButton>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t('menu')}>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={() => open('settings')}>
            ⚙️ {t('settings')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => open('howto')}>
            ❔ {t('howToPlay')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => open('rules')}>
            📖 {t('fullRules')}
          </Button>
          {inRoom && (
            <Button
              variant="destructive"
              fullWidth
              onClick={() => {
                setMenuOpen(false);
                setConfirmLeave(true);
              }}
            >
              🚪 {t('leaveGame')}
            </Button>
          )}
        </div>
      </Sheet>

      <Modal open={view === 'settings'} onClose={() => setView(null)} title={t('settings')}>
        <SettingsPanel />
      </Modal>
      <Modal open={view === 'howto'} onClose={() => setView(null)} title={t('howToPlay')}>
        <HowToPlay />
      </Modal>
      <Modal open={view === 'rules'} onClose={() => setView(null)} title={t('fullRules')}>
        <FullRules />
      </Modal>

      <ConfirmDialog
        open={confirmLeave}
        title={t('leaveConfirmTitle')}
        body={t('leaveConfirmBody')}
        confirmLabel={t('leaveGame')}
        destructive
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          intents.leave();
        }}
      />
    </>
  );
}

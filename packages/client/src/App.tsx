import { useEffect, useRef } from 'react';
import { selectScreen, useGameStore } from './store/gameStore.js';
import { getSocket } from './net/socket.js';
import { applyLanguage, applyTheme } from './lib/theme.js';
import { ConnectionBanner } from './components/ConnectionBanner.js';
import { ErrorToasts } from './components/ErrorToasts.js';
import { RotateHint } from './components/RotateHint.js';
import { Landing } from './screens/Landing.js';
import { Lobby } from './screens/Lobby.js';
import { Game } from './screens/Game.js';
import { GameOver } from './screens/GameOver.js';
import { useIsWide } from './components/game/useMedia.js';
import { cn } from './lib/cn.js';

export default function App() {
  const game = useGameStore((s) => s.game);
  const settings = useGameStore((s) => s.settings);
  const frameRef = useRef<HTMLDivElement>(null);
  const wide = useIsWide();

  // Connect once; apply persisted theme/language.
  useEffect(() => {
    applyTheme(settings.theme);
    applyLanguage(settings.language);
    getSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screen = selectScreen(game);

  // Move focus to the new screen on transition so keyboard/screen-reader users
  // land in the right place (§19).
  useEffect(() => {
    frameRef.current?.focus();
  }, [screen]);

  return (
    <div className="min-h-dvh text-ink">
      <RotateHint />
      <div
        ref={frameRef}
        tabIndex={-1}
        className={cn(
          'app-frame flex flex-col outline-none',
          // the game fills exactly one screen; on PC it gets the wide table
          screen === 'game' && 'fit-screen',
          screen === 'game' && wide && 'wide',
        )}
      >
        <ConnectionBanner />
        <ErrorToasts />
        {screen === 'landing' && <Landing />}
        {screen === 'lobby' && game && <Lobby game={game} />}
        {screen === 'game' && game && <Game game={game} />}
        {screen === 'gameover' && game && <GameOver game={game} />}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { selectScreen, useGameStore } from './store/gameStore.js';
import { getSocket } from './net/socket.js';
import { applyLanguage, applyTheme } from './lib/theme.js';
import { ConnectionBanner } from './components/ConnectionBanner.js';
import { ErrorToasts } from './components/ErrorToasts.js';
import { Landing } from './screens/Landing.js';
import { Lobby } from './screens/Lobby.js';
import { Game } from './screens/Game.js';
import { GameOver } from './screens/GameOver.js';

export default function App() {
  const game = useGameStore((s) => s.game);
  const settings = useGameStore((s) => s.settings);

  // Connect once; apply persisted theme/language.
  useEffect(() => {
    applyTheme(settings.theme);
    applyLanguage(settings.language);
    getSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screen = selectScreen(game);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <ConnectionBanner />
      <ErrorToasts />
      {screen === 'landing' && <Landing />}
      {screen === 'lobby' && game && <Lobby game={game} />}
      {screen === 'game' && game && <Game game={game} />}
      {screen === 'gameover' && game && <GameOver game={game} />}
    </div>
  );
}

// Place-card sound effect (the only audio in the game, per scope). Lazily loads
// the asset and respects the user's sound setting. No-op if audio is unavailable.

import { useGameStore } from '../store/gameStore.js';

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio('/sounds/card-place.wav');
    audio.preload = 'auto';
    audio.volume = 0.5;
  }
  return audio;
}

export function playPlaceCard(): void {
  if (!useGameStore.getState().settings.sound) return;
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {
      /* autoplay/user-gesture restrictions — ignore */
    });
  } catch {
    /* ignore */
  }
}

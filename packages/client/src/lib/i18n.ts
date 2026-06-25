// Tiny i18n layer (§23.2). UI chrome is translated for en/nl/de; the full rules
// and how-to-play reference stay English-only in v1. English is the default.

import type { Locale } from '@wizarden/shared';
import { useGameStore } from '../store/gameStore.js';

type Key =
  | 'tagline'
  | 'yourName'
  | 'createRoom'
  | 'joinRoom'
  | 'roomCode'
  | 'howToPlay'
  | 'fullRules'
  | 'leaderboard'
  | 'noWinnersYet'
  | 'settings'
  | 'sound'
  | 'animations'
  | 'theme'
  | 'light'
  | 'dark'
  | 'language'
  | 'menu'
  | 'close'
  | 'cancel'
  | 'lobby'
  | 'players'
  | 'host'
  | 'specials'
  | 'gameMode'
  | 'trump'
  | 'noTrump'
  | 'yourBid'
  | 'yourTurn'
  | 'full'
  | 'half'
  | 'rounds'
  | 'invite'
  | 'linkCopied'
  | 'startGame'
  | 'needMorePlayers'
  | 'addBot'
  | 'waitingForHost'
  | 'leaveGame'
  | 'leaveConfirmTitle'
  | 'leaveConfirmBody'
  | 'playAgain'
  | 'gameOver'
  | 'winner'
  | 'winners'
  | 'backToStart'
  | 'connecting'
  | 'wakingServer'
  | 'reconnecting'
  | 'pausedFor'
  | 'sessionEnded'
  | 'retry'
  | 'points'
  | 'you';

const en: Record<Key, string> = {
  tagline: 'Wizard — 30-Year Edition',
  yourName: 'Your name',
  createRoom: 'Create room',
  joinRoom: 'Join room',
  roomCode: 'Room code',
  howToPlay: 'How to play',
  fullRules: 'Full rules',
  leaderboard: 'Leaderboard',
  noWinnersYet: 'No games won yet.',
  settings: 'Settings',
  sound: 'Sound',
  animations: 'Animations',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  language: 'Language',
  menu: 'Menu',
  close: 'Close',
  cancel: 'Cancel',
  lobby: 'Lobby',
  players: 'Players',
  host: 'Host',
  specials: 'Special cards',
  gameMode: 'Game mode',
  trump: 'Trump',
  noTrump: 'No trump',
  yourBid: 'Your bid',
  yourTurn: 'your turn',
  full: 'Full',
  half: 'Half',
  rounds: 'rounds',
  invite: 'Invite',
  linkCopied: 'Link copied!',
  startGame: 'Start game',
  needMorePlayers: 'Need 3–6 players to start',
  addBot: 'Add bot',
  waitingForHost: 'Waiting for the host to start…',
  leaveGame: 'Leave game',
  leaveConfirmTitle: 'Leave this game?',
  leaveConfirmBody: 'You cannot rejoin once you leave.',
  playAgain: 'Play again',
  gameOver: 'Game over',
  winner: 'Winner',
  winners: 'Winners',
  backToStart: 'Back to start',
  connecting: 'Connecting…',
  wakingServer: 'Waking up the server… this can take up to a minute.',
  reconnecting: 'Reconnecting…',
  pausedFor: 'Paused — waiting for',
  sessionEnded: 'Your session ended.',
  retry: 'Retry',
  points: 'pts',
  you: 'You',
};

const nl: Record<Key, string> = {
  tagline: 'Wizard — 30-jarig jubileum',
  yourName: 'Je naam',
  createRoom: 'Kamer maken',
  joinRoom: 'Deelnemen',
  roomCode: 'Kamercode',
  howToPlay: 'Hoe te spelen',
  fullRules: 'Volledige regels',
  leaderboard: 'Ranglijst',
  noWinnersYet: 'Nog geen potjes gewonnen.',
  settings: 'Instellingen',
  sound: 'Geluid',
  animations: 'Animaties',
  theme: 'Thema',
  light: 'Licht',
  dark: 'Donker',
  language: 'Taal',
  menu: 'Menu',
  close: 'Sluiten',
  cancel: 'Annuleren',
  lobby: 'Lobby',
  players: 'Spelers',
  host: 'Host',
  specials: 'Speciale kaarten',
  gameMode: 'Spelmodus',
  trump: 'Troef',
  noTrump: 'Geen troef',
  yourBid: 'Jouw voorspelling',
  yourTurn: 'jouw beurt',
  full: 'Volledig',
  half: 'Half',
  rounds: 'rondes',
  invite: 'Uitnodigen',
  linkCopied: 'Link gekopieerd!',
  startGame: 'Spel starten',
  needMorePlayers: '3–6 spelers nodig om te starten',
  addBot: 'Bot toevoegen',
  waitingForHost: 'Wachten tot de host start…',
  leaveGame: 'Spel verlaten',
  leaveConfirmTitle: 'Dit spel verlaten?',
  leaveConfirmBody: 'Je kunt niet opnieuw deelnemen nadat je vertrekt.',
  playAgain: 'Opnieuw spelen',
  gameOver: 'Spel afgelopen',
  winner: 'Winnaar',
  winners: 'Winnaars',
  backToStart: 'Terug naar start',
  connecting: 'Verbinden…',
  wakingServer: 'Server opstarten… dit kan tot een minuut duren.',
  reconnecting: 'Opnieuw verbinden…',
  pausedFor: 'Gepauzeerd — wachten op',
  sessionEnded: 'Je sessie is beëindigd.',
  retry: 'Opnieuw',
  points: 'ptn',
  you: 'Jij',
};

const de: Record<Key, string> = {
  tagline: 'Wizard — 30-Jahre-Edition',
  yourName: 'Dein Name',
  createRoom: 'Raum erstellen',
  joinRoom: 'Beitreten',
  roomCode: 'Raumcode',
  howToPlay: 'Spielanleitung',
  fullRules: 'Vollständige Regeln',
  leaderboard: 'Bestenliste',
  noWinnersYet: 'Noch keine Spiele gewonnen.',
  settings: 'Einstellungen',
  sound: 'Ton',
  animations: 'Animationen',
  theme: 'Design',
  light: 'Hell',
  dark: 'Dunkel',
  language: 'Sprache',
  menu: 'Menü',
  close: 'Schließen',
  cancel: 'Abbrechen',
  lobby: 'Lobby',
  players: 'Spieler',
  host: 'Host',
  specials: 'Sonderkarten',
  gameMode: 'Spielmodus',
  trump: 'Trumpf',
  noTrump: 'Kein Trumpf',
  yourBid: 'Deine Ansage',
  yourTurn: 'du bist dran',
  full: 'Voll',
  half: 'Halb',
  rounds: 'Runden',
  invite: 'Einladen',
  linkCopied: 'Link kopiert!',
  startGame: 'Spiel starten',
  needMorePlayers: '3–6 Spieler zum Starten nötig',
  addBot: 'Bot hinzufügen',
  waitingForHost: 'Warte auf den Host…',
  leaveGame: 'Spiel verlassen',
  leaveConfirmTitle: 'Dieses Spiel verlassen?',
  leaveConfirmBody: 'Nach dem Verlassen kannst du nicht erneut beitreten.',
  playAgain: 'Nochmal spielen',
  gameOver: 'Spiel vorbei',
  winner: 'Sieger',
  winners: 'Sieger',
  backToStart: 'Zurück zum Start',
  connecting: 'Verbinde…',
  wakingServer: 'Server wird gestartet… das kann bis zu einer Minute dauern.',
  reconnecting: 'Neu verbinden…',
  pausedFor: 'Pausiert — warte auf',
  sessionEnded: 'Deine Sitzung ist beendet.',
  retry: 'Erneut',
  points: 'Pkt',
  you: 'Du',
};

const CATALOGUES: Record<Locale, Record<Key, string>> = { en, nl, de };

export function translate(locale: Locale, key: Key): string {
  return CATALOGUES[locale]?.[key] ?? en[key];
}

/** Hook: returns a `t(key)` bound to the current language setting. */
export function useT(): (key: Key) => string {
  const locale = useGameStore((s) => s.settings.language);
  return (key: Key) => translate(locale, key);
}

export type { Key as MessageKey };

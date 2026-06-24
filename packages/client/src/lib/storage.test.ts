import { afterEach, describe, expect, it } from 'vitest';
import { storage } from './storage.js';

afterEach(() => localStorage.clear());

describe('storage (persistence §18)', () => {
  it('defaults settings to dark + english + sound on', () => {
    expect(storage.getSettings()).toEqual({
      sound: true,
      animations: true,
      theme: 'dark',
      language: 'en',
    });
  });

  it('persists and reloads settings', () => {
    storage.setSettings({ sound: false, animations: true, theme: 'light', language: 'nl' });
    expect(storage.getSettings()).toEqual({
      sound: false,
      animations: true,
      theme: 'light',
      language: 'nl',
    });
  });

  it('persists name and session, and clears the session', () => {
    storage.setName('Lasse');
    storage.setSession({ token: 'tok', roomCode: 'ABCD' });
    expect(storage.getName()).toBe('Lasse');
    expect(storage.getSession()).toEqual({ token: 'tok', roomCode: 'ABCD' });
    storage.clearSession();
    expect(storage.getSession()).toBeNull();
    expect(storage.getName()).toBe('Lasse'); // name survives a session clear
  });
});

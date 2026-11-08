import { expect, test } from '@playwright/test';

// Smoke E2E: two real browser contexts create/join a room and start a game.
// Requires Chromium (`pnpm e2e:install`) and runs the full prod-like stack via
// the webServers in playwright.config.ts. Also runs in CI (e2e job).
test('two players create + join a room and start a game (with a bot)', async ({ browser }) => {
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hp = await host.newPage();
  const gp = await guest.newPage();

  // Host creates a room.
  await hp.goto('/');
  await hp.getByLabel(/your name/i).fill('Alice');
  await hp.getByRole('button', { name: /create room/i }).click();
  await expect(hp.getByRole('heading', { name: /players/i })).toBeVisible();

  const code = (await hp.getByLabel(/room code/i).textContent())?.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}$/);

  // Guest joins via the shareable room link.
  await gp.goto(`/?room=${code}`);
  await gp.getByLabel(/your name/i).fill('Bob');
  await gp.getByRole('button', { name: /^join$/i }).click();
  await expect(hp.getByText('Bob')).toBeVisible();

  // Host adds a debug bot (=> 3 players) and starts.
  await hp.getByRole('button', { name: /add bot/i }).click();
  await hp.getByRole('button', { name: /start game/i }).click();

  // Both clients reach the live game (round indicator R1/…).
  await expect(hp.getByText(/Round 1\//)).toBeVisible({ timeout: 15_000 });
  await expect(gp.getByText(/Round 1\//)).toBeVisible({ timeout: 15_000 });

  await host.close();
  await guest.close();
});

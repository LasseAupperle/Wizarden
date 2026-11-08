// One-off generator for the PWA raster icons + Open Graph image (spec §22/§24.2).
//
// Rasterises the original `public/icon.svg` with the Chromium that Playwright
// already uses for E2E, so no native image dependency (sharp/resvg) is needed.
// Outputs are committed; re-run only when the icon or brand art changes:
//
//   pnpm --filter @wizarden/client gen:icons
//
// Set PW_CHROMIUM_PATH to use a pre-installed Chromium instead of Playwright's.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');
const fontDir = (pkg) => join(here, '..', 'node_modules', '@fontsource', pkg, 'files');

const iconSvg = readFileSync(join(pub, 'icon.svg'), 'utf8');
const fontUri = (pkg, file) =>
  `data:font/woff2;base64,${readFileSync(join(fontDir(pkg), file)).toString('base64')}`;

const BG = '#14121C';

// The hat + stars, without icon.svg's rounded background square — reused for the
// full-bleed variants (maskable / apple-touch) where the OS applies its own mask.
const hatOnly = iconSvg
  .replace(/<rect[^>]*\/>/, '')
  .replace('<svg ', '<svg width="100%" height="100%" ');

/** Plain icon: the SVG as-is (rounded square, transparent corners). */
const plainHtml = (size) => `
  <body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px">${iconSvg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
  </body>`;

/** Full-bleed icon: square background, artwork scaled into the central safe zone. */
const fullBleedHtml = (size, artScale) => `
  <body style="margin:0;background:${BG}">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center">
      <div style="width:${size * artScale}px;height:${size * artScale}px">${hatOnly}</div>
    </div>
  </body>`;

const SUITS = [
  ['#e5484d', '◆', -14, 0],
  ['#3b82f6', '●', -4, 12],
  ['#2fb87a', '▲', 6, 24],
  ['#ffd23f', '★', 16, 36],
];

const ogHtml = `
  <style>
    @font-face { font-family: Cinzel; font-weight: 700; src: url(${fontUri('cinzel', 'cinzel-latin-700-normal.woff2')}); }
    @font-face { font-family: Outfit; font-weight: 500; src: url(${fontUri('outfit', 'outfit-latin-500-normal.woff2')}); }
    * { box-sizing: border-box; }
    body { margin: 0; }
    .og {
      width: 1200px; height: 630px; position: relative; overflow: hidden;
      background:
        radial-gradient(700px 420px at 18% 30%, rgba(124,92,255,0.35), transparent 70%),
        radial-gradient(600px 400px at 95% 95%, rgba(255,95,162,0.22), transparent 70%),
        ${BG};
      display: flex; align-items: center; gap: 56px; padding: 0 88px;
      font-family: Outfit, sans-serif; color: #f2eefc;
    }
    .icon { width: 260px; height: 260px; flex: none; filter: drop-shadow(0 24px 48px rgba(124,92,255,0.45)); }
    h1 {
      font-family: Cinzel, serif; font-weight: 700; font-size: 112px; line-height: 1; margin: 0;
      background: linear-gradient(105deg, #b9a6ff 0%, #ff8fc4 45%, #f4cf76 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    p { font-size: 36px; line-height: 1.3; margin: 22px 0 0; color: #cfc6ea; font-weight: 500; }
    .tag { margin-top: 30px; display: inline-block; font-size: 24px; padding: 10px 22px;
      border-radius: 999px; background: linear-gradient(135deg, #8b6bff 0%, #ff5fa2 100%); color: #fff; }
    .cards { position: absolute; right: 0px; top: -72px; }
    .card { position: absolute; width: 120px; height: 172px; border-radius: 16px;
      display: grid; place-items: center; font-size: 56px; color: rgba(255,255,255,0.85);
      box-shadow: 0 18px 40px rgba(0,0,0,0.45); opacity: 0.9; }
  </style>
  <div class="og">
    <div class="cards">
      ${SUITS.map(
        ([c, g, rot, off], i) =>
          `<div class="card" style="background:${c};right:${i * 70}px;top:${off}px;transform:rotate(${rot}deg);${
            c === '#ffd23f' ? 'color:rgba(0,0,0,0.7);' : ''
          }">${g}</div>`,
      ).join('')}
    </div>
    <div class="icon">${iconSvg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    <div>
      <h1>Wizarden</h1>
      <p>Real-time multiplayer Wizard<br/>for 3–6 friends, on your phone.</p>
      <span class="tag">Create a room · share the link · play</span>
    </div>
  </div>`;

const jobs = [
  // [file, size, html, transparent]
  ['icon-192.png', 192, plainHtml(192), true],
  ['icon-512.png', 512, plainHtml(512), true],
  // maskable: art inside the 80% safe zone (Android crops to circle/squircle)
  ['icon-maskable-512.png', 512, fullBleedHtml(512, 1.05), false],
  // iOS applies its own rounded mask and ignores transparency
  ['apple-touch-icon.png', 180, fullBleedHtml(180, 1.15), false],
  ['favicon-32.png', 32, plainHtml(32), true],
];

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
try {
  for (const [file, size, html, transparent] of jobs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(html);
    writeFileSync(
      join(pub, file),
      await page.screenshot({ omitBackground: transparent, type: 'png' }),
    );
    await page.close();
    console.log(`wrote public/${file}`);
  }

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(ogHtml);
  await og.evaluate(() => document.fonts.ready);
  writeFileSync(join(pub, 'og-image.png'), await og.screenshot({ type: 'png' }));
  console.log('wrote public/og-image.png');
} finally {
  await browser.close();
}

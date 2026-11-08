# Assets & licences

Every third-party asset used by Wizarden, with its source and licence. No AMIGO
artwork or copyrighted Wizard assets are used — all visuals are original.

| Asset | Used for | Source | Licence |
|-------|----------|--------|---------|
| **Cinzel** (font) | Wordmark + headings | `@fontsource/cinzel` (npm), self-hosted in the bundle | SIL Open Font License 1.1 |
| **Outfit** (font) | UI, body, card numerals | `@fontsource/outfit` (npm), self-hosted in the bundle | SIL Open Font License 1.1 |
| **lucide-react** (icons) | Special-card emblems (Dragon=Flame, Fairy=Sparkles, Bomb, Werewolf=Moon, Juggler=Orbit, Cloud, Witch=Wand, Shapeshifter=Repeat), Wizard/Jester faces | lucide.dev (npm `lucide-react`) | ISC |
| **Custom Bat SVG** | Vampire emblem (lucide has no bat) | Original, hand-drawn (`components/CardArt.tsx`) | Original — project-owned |
| **App icon** (`public/icon.svg`) | Favicon, PWA icon, OG image | Original (wizard hat + stars) | Original — project-owned |
| **Raster icons + OG image** (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `og-image.png`) | PWA install, iOS home screen, link previews | Generated from `icon.svg` by `packages/client/scripts/gen-icons.mjs` (uses Cinzel/Outfit above) | Original — project-owned |
| **Emoji glyphs** | A few menu/status glyphs (☰ 🏆 📊 🔗 🤖) | Native OS/browser emoji (Unicode) | No asset shipped — rendered by the device font; no licence needed |
| **Suit glyphs** | Card suit markers (◆ ● ▲ ★) | Unicode geometric shapes | No asset shipped |
| **`card-place.wav`** | Place-card sound effect | Copied from the sibling **LiarsGame** project (`frontend/public/assets/sounds/card-place.wav`) | ⚠️ **Unverified.** Fine for private play among friends; confirm the original sound's licence (or replace it with a CC0 sound) before any public/commercial release |

## Notes
- Suit colours pair with a shape/glyph + letter so the game never relies on
  colour alone (colour-blind support, §14/§19).
- Fonts are self-hosted via `@fontsource` (imported in `src/main.tsx`) — no
  Google Fonts CDN request at runtime.
- Card emblems use `lucide-react` (ISC) at a consistent stroke weight, plus one
  original custom Bat SVG for the Vampire. Number cards are colour-fill + suit
  glyph watermark + corner indices; Wizard/Jester/specials use a gradient face
  with a gold ring.
- The web manifest ships the SVG icon plus PNG 192/512 (`any`) and a 512
  `maskable` variant (art kept inside the 80% safe zone). Regenerate all rasters
  with `pnpm --filter @wizarden/client gen:icons` after changing `icon.svg`.

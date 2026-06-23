# Assets & licences

Every third-party asset used by Wizarden, with its source and licence. No AMIGO
artwork or copyrighted Wizard assets are used — all visuals are original.

| Asset | Used for | Source | Licence |
|-------|----------|--------|---------|
| **Cinzel** (font) | Wordmark + headings | Google Fonts | SIL Open Font License 1.1 |
| **Outfit** (font) | UI, body, card numerals | Google Fonts | SIL Open Font License 1.1 |
| **lucide-react** (icons) | Special-card emblems (Dragon=Flame, Fairy=Sparkles, Bomb, Werewolf=Moon, Juggler=Orbit, Cloud, Witch=Wand, Shapeshifter=Repeat), Wizard/Jester faces | lucide.dev (npm `lucide-react`) | ISC |
| **Custom Bat SVG** | Vampire emblem (lucide has no bat) | Original, hand-drawn (`components/CardArt.tsx`) | Original — project-owned |
| **Emoji glyphs** | A few menu/status glyphs (☰ 🏆 📊 🔗) | Native OS/browser emoji (Unicode) | No asset shipped — rendered by the device font; no licence needed |
| **Suit glyphs** | Card suit markers (◆ ● ▲ ★) | Unicode geometric shapes | No asset shipped |
| **`card-place.wav`** | Place-card sound effect | Copied from the sibling **LiarsGame** project (`frontend/public/assets/sounds/card-place.wav`) | ⚠️ Project-owned copy; confirm the original sound's licence before any public/commercial release |

## Notes
- Suit colours pair with a shape/glyph + letter so the game never relies on
  colour alone (colour-blind support, §14/§19).
- Fonts load from the Google Fonts CDN (`<link>` in `index.html`). For a fully
  self-hosted build, swap to `@fontsource/cinzel` + `@fontsource/outfit` (both OFL).
- Card emblems use `lucide-react` (ISC) at a consistent stroke weight, plus one
  original custom Bat SVG for the Vampire. Number cards are colour-fill + suit
  glyph watermark + corner indices; Wizard/Jester/specials use a gradient face
  with a gold ring.
- The web manifest (`packages/client/public/manifest.webmanifest`) currently has
  no icons; original maskable/standard icons (192/512) are a Phase 9 to-do and
  must be original art.

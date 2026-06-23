# Assets & licences

Every third-party asset used by Wizarden, with its source and licence. No AMIGO
artwork or copyrighted Wizard assets are used — all visuals are original.

| Asset | Used for | Source | Licence |
|-------|----------|--------|---------|
| **Cinzel** (font) | Wordmark + headings | Google Fonts | SIL Open Font License 1.1 |
| **Outfit** (font) | UI, body, card numerals | Google Fonts | SIL Open Font License 1.1 |
| **Emoji glyphs** | Card emblems, menu/icon glyphs | Native OS/browser emoji (Unicode) | No asset shipped — rendered by the device font; no licence needed |
| **`card-place.wav`** | Place-card sound effect | Copied from the sibling **LiarsGame** project (`frontend/public/assets/sounds/card-place.wav`) | ⚠️ Project-owned copy; confirm the original sound's licence before any public/commercial release |

## Notes
- Suit colours pair with a shape/glyph + letter so the game never relies on
  colour alone (colour-blind support, §14/§19).
- Fonts load from the Google Fonts CDN (`<link>` in `index.html`). For a fully
  self-hosted build, swap to `@fontsource/cinzel` + `@fontsource/outfit` (both OFL).
- Card emblems currently use Unicode emoji. If swapped for `lucide-react` icons
  later (ISC licence) or custom SVG, add them here.
- The web manifest (`packages/client/public/manifest.webmanifest`) currently has
  no icons; original maskable/standard icons (192/512) are a Phase 9 to-do and
  must be original art.

# Brand: the mark, the icons and where they appear

**The mark.** A factory whose right half is a grid of cells: the real plant becoming its digital twin. The top-right cell
is lit in cyan (`#7FE4FF`), the live signal.
- Drawn on a 32-unit grid and optically centred.
- The tile is a rounded square (radius 8/32) on a 135° gradient from `#2D5BFF` to the brand blue `#1428A0`, with a hairline inner highlight.
- It reads at 16 px: the factory stays a factory and the grid becomes a texture.

**One source.** `tools/brand/marks.mjs` holds the geometry and the colours. `node tools/brand/build.mjs` writes everything else:

| Output | What |
|---|---|
| `assets/brand/logo.svg`, `glyph.svg`, `maskable.svg` | the mark, the glyph alone, the Android adaptive icon |
| `assets/brand/icon-16…512.png`, `maskable-512.png` | favicons, the Apple touch icon, the install icons |
| `assets/brand/mod-*.svg`, `mod-*-96.png` | the module icons: live plant, command room, presentation, guide, showroom, presentation mode |
| `assets/brand/og.jpg` | the 1200 × 630 card shown when a link is shared |
| `assets/brand/site.webmanifest` | the installable app, with shortcuts to the plant, the command room, the presentation mode and the guide |
| the `df-icons` block in every page head | icons, manifest, theme colour, Open Graph and Twitter tags |
| the `df-brand` block in `assets/css/theme.css` | the glyph as two CSS masks (white and the lit cell) for `.logo-mark` |
| the `df-splash` block in app, plant and showroom | the inline start-up mark whose cells light up one by one |
| the `df-mark` block in `assets/js/brand.js` | the geometry for canvases (the 3D lobby wall and the rating plates) |

Never hand-edit those blocks: change `marks.mjs` and rebuild.

**Where the mark appears:**
- every page header, the browser tab and the slide footer;
- the start-up splash, which lifts when the plant is fully drawn (12 s at most; still with reduced motion);
- the lobby wall and the machines' rating plates in the 3D plant;
- the presentation mode's top letterbox;
- the shared-link card;
- the installed app's icon and its shortcuts.

**Module icons** (`.mod-ic .mod-<name>`) are the same tile with a white line glyph (2 units, round joins) and one part in
the live cyan. They mark links to each part: the command room's sidebar, the home page's capability list, the plant's
header and the guide's footer.

The mark is our own; it imitates no real company's logo.

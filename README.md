# Digital Factory

A live digital twin, predictive AI and a production copilot for electronics manufacturing — delivered as a static web app (no install, no server, works offline).

| Page | What it is |
|---|---|
| `index.html` | Landing page: the vision and the six modules |
| `app.html` | **Command Center** — live plant floor, predictive maintenance, AI vision quality, what-if simulator, energy, Arabic/English copilot |
| `deck.html` | **Vision deck** — 13 slides with an embedded live demo, an editable ROI calculator and speaker notes in Arabic |

All plant data is simulated for demonstration.

## Presenting

**Deck** (`deck.html`): `←` / `→` (or a presentation clicker) to navigate · `L` or the **ع** button switches between English and formal Arabic (`deck.html?lang=ar` opens in Arabic) · `F` full screen · `N` speaker notes.

**Command Center** (`app.html`):
- `🎬 Scenarios` (or `P`) triggers live events: bearing wear, solder-paste drift, material shortage, peak-tariff spike, sudden breakdown. *Auto-play* runs the story by itself.
- `🤖 Ask Copilot` (or `C`) — try "Summarize this shift" or "لخّصلي الوردية".
- `1`–`5` switch views.

Suggested live moment: start *Bearing wear on Mounter B*, wait ~15 s for the AI alert, let the audience click **Schedule repair** and watch the "≈ EGP 1.6M saved" result. Leave it alone instead and the line stops — that's the contrast.

## Run locally

Open `index.html` in a browser, or serve the folder: `python3 -m http.server`.

## Deploy

`.github/workflows/pages.yml` publishes the repo to GitHub Pages on every push. In the repo settings, set **Pages → Source → GitHub Actions** once.

## Craft & quality

Typography, motion and quality checks follow the Animation studio's web method (`coolman1984/animation`, `studio/web/WEB.md`):
words rise from blur, sticky scrollytelling, reduced-motion support, and a real-browser gate at 390 / 820 / 1440 px
(no sideways scroll, WCAG AA contrast, nothing hidden by motion). Fonts: Alexandria + JetBrains Mono (SIL OFL, `assets/fonts/`).
Honesty: plant data is labelled as simulated; industry ranges cite their source; Samsung is named as text only, with no logo artwork.

## Structure

```
assets/css/  base.css (tokens) · app.css · deck.css
assets/js/   sim.js (plant simulation engine) · app.js (UI) · charts.js · deck.js · motion.js (page motion)
assets/fonts/ Alexandria, JetBrains Mono + licences
```

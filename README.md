# Digital Factory

A live digital twin, AI agents and a production copilot for electronics manufacturing. Prepared for Plant EG-01, a fictional electronics plant.
Static web app: no install, no server, works offline. Light and dark themes, built on the brand UI kit (`assets/kit/`).

| Page | What it is |
|---|---|
| `index.html` | Website: the vision, the industry's 2030 direction, the capabilities and the 12-week pilot |
| `plant.html` | **Live plant in 3D**: the whole plant as a moving, unit-level twin: warehouses, SMT, supermarket, assembly, burn-in, QC, packing, finished goods, docks, AGVs, forklifts, trucks and people; select anything; every unit has a passport; twelve drills that the agents pick up from the plant's own data, with the cause path drawn in 3D |
| `app.html` | **Command room** on the same twin: plant mimic, value stream, agent cases with simulated futures, ISA-18.2 alarms, control previewed on the twin, predictions, root cause and genealogy, what-if lab, drills, leadership, maintenance, quality, energy, a time machine and the copilot |
| `deck.html` | **Presentation**: 19 slides with the live demo embedded, a live briefing built from a pinned plant moment, an editable business case and speaker notes |
| `guide.html` | **Reference guide**, Arabic and English: the idea, how it works, every screen, decision and scenario, the live briefing, full translations of the website and the presentation, and a searchable glossary of every term |
| `docs/RESEARCH.md` | Research brief on the world's best factories, with sources, and the ideas built from it |

All plant data is simulated. Plant EG-01 is fictional; no real company or city is named for it.

## Presenting

**Presentation** (`deck.html`): `←` `→` or a clicker · `T` light / dark · `F` full screen · `N` speaker notes · `B` live briefing.

**Live briefing**: in the command room press **Send to deck** (`P`) at the moment you want to show (during a time-machine replay it pins that moment);
slides 2 and 3 of the presentation are then written from that moment and stay fixed. In the presentation, `B` opens the panel to
follow the plant live, pick a stored moment, or *Read the plant now*. Moments live in this browser's storage only.

**Live plant** (`plant.html`): `Space` pause · `1` `2` `3` speed 1× / 4× / 16× · `G` guided tour · `/` find a serial · `C` copilot · `Esc` clear.
Start the guided tour, then let the guest select a TV and press *Follow in 3D*; *Run a drill* shows a cause travelling through the plant.
Deep links: `plant.html#st:L1-MounterB`, `#unit:<serial>`, `#drill:bearing`, `#tour`.

**Command room** (`app.html`):
- `Drills` (`8`): start one of twelve real-world drills; `16×` in the top bar makes the agents' work visible in a minute.
- `AI agents` (`4`): set each agent to *Advise only*, *Ask first* or *Auto* (inside the plant policy); open any case for its evidence, futures and trace.
- `What-if lab` (`7`): play up to three options against doing nothing, several futures each.
- `Time machine` (`M`): rebuild any moment of the last 30 plant minutes exactly; *Branch from here* plays alternatives against what really happened.
- `Ask copilot` (`C`): local mode reads the twin in the browser; Claude mode uses your own Anthropic API key (tool use, streaming, every change waits for your approval).
- `Space` pause · `T` light / dark · `P` send to deck · `1`–`9` switch views.

Suggested live moment: start *Bearing wear on Mounter B*, set 16×, and watch the maintenance agent open a case from the vibration
trend, recall a past case and play three options forward. When it reaches **Needs you**, let the guest approve it, then open **Leadership**.

The whole site runs one plant: open the command room and the 3D plant side by side and they stay in step; the plant continues on the
next visit (Drills → New shift starts over).

## Design

Direction, tokens and the reasons behind them: `PRODUCT.md`, `DESIGN.md`, `docs/ALLOWANCES.md`. Design changes go through the
reusable pipeline in `design-pipeline/` (installed into `.claude/skills/`).

## Run locally

Open `index.html` in a browser, or serve the folder: `python3 -m http.server`.

## Deploy

`.github/workflows/pages.yml` copies the site to the `gh-pages` branch on every push to `main`; GitHub Pages serves that branch
(Settings → Pages → Deploy from a branch → `gh-pages` / root).

## Structure

```
assets/kit/       Brand UI kit: brand-ui.css, fonts.css (Inter, IBM Plex Sans Arabic), icons.js
assets/css/       theme.css (tokens, theme, motion) · site.css · app.css · deck.css · guide.css
assets/js/        theme.js · motion.js · deck.js
                  twin-hero.js (the live SMT line drawn on the website and title slide) · site.js
                  briefing.js (the deck's live briefing) · guide.js · guide-terms.js (glossary and icon list for the guide)
assets/img/       open-licence factory photos, credits in assets/img/CREDITS.md
assets/js/plant/  engine (deterministic unit-level twin) · whatif + twin-worker (futures on forks, in workers)
                  hub (one plant across tabs and visits) · scene (three.js view) · ui (3D page panels, drills, tour)
assets/js/agents/ agents (the crew: detect, investigate, simulate, decide, act, verify) · cases-ui · copilot (local and Claude modes)
assets/js/room/   core · viz (SVG charts) · floor (plant mimic) · command · ops (alarms, control) · intel (agents, predictions,
                  root cause, what-if lab, drills) · perf (leadership, maintenance, quality, energy) · timemachine · briefing · main
assets/vendor/    three.js r170 and the Anthropic TypeScript SDK, each bundled once (see their READMEs)
```

Motion and quality checks follow the Animation studio's web method (`coolman1984/animation`): reveals, word-by-word headlines,
reduced-motion support, and a browser check at 390 / 820 / 1440 px for overflow, contrast and hidden content.

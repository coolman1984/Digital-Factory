# Digital Factory

A live digital twin, AI agents and a production copilot for electronics manufacturing. Prepared for Plant EG-01, a fictional electronics plant.
Static web app: no install, no server, works offline. Light and dark themes, built on the brand UI kit (`assets/kit/`).

| Page | What it is |
|---|---|
| `index.html` | Website: the vision, the industry's 2030 direction, the capabilities and the 12-week pilot |
| `plant.html` | **Live plant**: a whole TV plant as a unit-level twin. 3D: six main assembly lines and every sub-line (LCM, SMD/PBA with firmware download, injection, press and coating, cushions), the stores, milk runs, AGVs, forklifts, docks and the offices with the server room; data packets between the floor, GMES, SAP and the departments. 2D tabs: GMES boards, SAP and data flow, S&OP, MRP, Departments, AI agents (eight agents that simulate every option on a flow model of the plant before they recommend one, with autonomy per agent and an ask box). Every TV has a passport; nine drills with decisions that act on the plant |
| `app.html` | **Command room**: live plant floor, AI agent crew, alarms, control, predictions, root cause, scenarios, leadership, maintenance, quality, energy, what-if, copilot |
| `deck.html` | **Presentation**: 19 slides with the live demo embedded, a live briefing built from a pinned plant moment, an editable business case and speaker notes |
| `guide.html` | **Reference guide**, Arabic and English: the idea, how it works, every screen, decision and scenario, the live briefing, full translations of the website and the presentation, and a searchable glossary of every term |
| `docs/RESEARCH.md` | Research brief on the world's best factories, with sources, and the ideas built from it |

All plant data is simulated. Plant EG-01 is fictional; no real company or city is named for it.

## Presenting

**Presentation** (`deck.html`): `←` `→` or a clicker · `T` light / dark · `F` full screen · `N` speaker notes · `B` live briefing.

**Live briefing**: in the command room press **Send to deck** (`P`), or ask the copilot "Prepare the briefing", at the moment you want to show;
slides 2 and 3 of the presentation are then written from that moment and stay fixed. In the presentation, `B` opens the panel to
follow the plant live, pick a stored moment, or *Read the plant now*. Moments live in this browser's storage only.

**Live plant** (`plant.html`): `Space` pause · `1` `2` `3` speed 1× / 4× / 16× · `G` guided tour · `/` find a serial · `Esc` clear.
Start the guided tour, then let the guest select a TV and press *Follow in 3D*; *Run a drill* shows a cause travelling through the plant.
Deep links: `plant.html#st:SMD4-MounterB`, `#line:ML1`, `#dept:planning`, `#mrp:OC-65`, `#mode:sop`, `#unit:<serial>`, `#drill:container`, `#tour`. Arrow keys move between the tabs.

**Command room** (`app.html`):
- `Scenarios` (or `7`): run one of ten real-world drills, or leave *Auto-play story* on.
- `AI agents` (`4`): set each agent to Advise, Approve or Auto, then watch the audit trail.
- `Time machine` (`M`): replay the last minutes of the plant.
- `Ask copilot` (`C`): "Summarize this shift", "Will we hit the plan?", "Write the shift handover".
- `T` light / dark · `1`–`9` switch views.

Suggested live moment: run *Bearing wear on Mounter B*, wait about 15 s for the prediction, and let the guest click
**Schedule repair**. Then open **Leadership**.

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
assets/js/        sim.js (plant engine: lines, alarms, agents, forecasts, scenarios, history) · charts.js · theme.js · motion.js · deck.js
                  twin-hero.js (the live SMT line drawn on the website and title slide) · site.js
                  briefing.js (the deck's live briefing) · guide.js · guide-terms.js (glossary and icon list for the guide)
assets/img/       open-licence factory photos, credits in assets/img/CREDITS.md
assets/js/plant/  engine (unit-level plant model) · erp (SAP, GMES, S&OP, MRP, departments) · agents (AI crew, flow-model forecast) · scene (three.js view) · views2d (2D tabs) · ui (panels, drills, tour)
assets/vendor/    three.js r170, bundled once (see assets/vendor/three/README.md)
assets/js/app/    core · floor · command · intel (agents, alarms, predictions, root cause, scenarios, control) · perf · copilot · briefing · main
```

Motion and quality checks follow the Animation studio's web method (`coolman1984/animation`): reveals, word-by-word headlines,
reduced-motion support, and a browser check at 390 / 820 / 1440 px for overflow, contrast and hidden content.

# Digital Factory

A live digital twin, AI agents and a production copilot for electronics manufacturing. Prepared for Plant EG-01, a fictional TV plant with six main assembly lines.
Static web app: no install, no server, works offline. Light and dark themes, built on the brand UI kit (`assets/kit/`).

| Page | What it is |
|---|---|
| `index.html` | Website: the vision, the industry's 2030 direction, the capabilities and the 12-week pilot |
| `plant.html` | **Live plant**: a whole TV plant as a unit-level twin. 3D: six main assembly lines and every sub-line (LCM, SMD/PBA with firmware download, injection, press and coating, cushions), the stores, milk runs, AGVs, forklifts, docks and the offices with the server room; data packets between the floor, GMES, SAP and the departments. 2D tabs: GMES boards, SAP and data flow, S&OP, MRP, Departments, AI agents (nine agents that simulate every option on a flow model of the plant before they recommend one, with autonomy per agent and an ask box). GMES adds andon escalation, the OEE loss tree and an 8-hour schedule; Departments adds SPC, NCR/8D, SAP PM work orders and the skills matrix. Every machine has HMI control behind interlocks with the effect simulated first, and the CCTV feeds run AI vision (people, vehicles, near misses, PPE). Every TV has a passport; nine drills with decisions that act on the plant |
| `app.html` | **Command room** on the same Plant EG-01 as the 3D plant (same engine, enterprise layer and nine agents): plant mimic of all six main lines and every line, store and vehicle feeding them, value stream, the agents' decisions with the options they simulated, ISA-18.2 alarms, control of each main line and any machine's HMI behind interlocks, predictions, root cause and genealogy, what-if lab with the scheduling drafts, nine drills, leadership, maintenance, quality, energy, a time machine and the copilot. Every object deep-links to the same object in 3D |
| `deck.html` | **Presentation**: 20 slides with the live demo embedded, a live briefing built from a pinned plant moment or a past time window of the live plant, an editable business case and speaker notes |
| `guide.html` | **Reference guide**, Arabic and English: the idea, how it works, every screen, decision and scenario, the live briefing, full translations of the website and the presentation, and a searchable glossary of every term |
| `docs/RESEARCH.md` | Research brief on the world's best factories, with sources, and the ideas built from it |

All plant data is simulated. Plant EG-01 is fictional; no real company or city is named for it.

## Presenting

**Presentation** (`deck.html`): `←` `→` or a clicker · `T` light / dark · `F` full screen · `N` speaker notes · `B` live briefing.

**Live briefing**: in the command room press **Send to deck** (`P`) at the moment you want to show (during a time-machine replay it pins that moment);
slides 2 and 3 of the presentation are then written from that moment and stay fixed. In the presentation, `B` opens the panel to
follow the plant live, pick a stored moment, or *Read the plant now*. Moments live in this browser's storage only.

**Time-window review**: the live plant records the whole shift as it runs (events, agent decisions with the options they simulated,
actions, one frame of readouts per plant minute). In the presentation, `B` → *Time window*: pick a detected problem or a From/To
time (e.g. 13:00–13:30), and slides 2–4 tell what happened, what the AI did and what was decided; `+30 min` / `+1 h` / `+2 h` or
*Play* show what changed afterwards. *Build a sample shift* makes a demo recording in about 30 s; *Export PowerPoint* saves the
three slides as an editable .pptx (PptxGenJS, vendored in `assets/vendor/`, loaded only on demand).

**Live plant** (`plant.html`): `Space` pause · `1` `2` `3` speed 1× / 4× / 16× · `G` guided tour · `R` replay the last 45 minutes · `/` find a serial · `Esc` clear.
*Walk* puts you on the floor at eye height: the crosshair shows the live state of what you look at (`F` for details), `G` walks you
along a route drawn on the floor to the selection, `R` rides along with the forklift or milk run you look at; vehicles stop for you.
Start the guided tour, then let the guest select a TV and press *Follow in 3D*; *Run a drill* shows a cause travelling through the plant.
Deep links: `plant.html#st:SMD4-MounterB`, `#line:ML1`, `#dept:planning`, `#mrp:OC-65`, `#mode:sop`, `#unit:<serial>`, `#drill:container`, `#tour`. Arrow keys move between the tabs.

**Command room** (`app.html`):
- `Drills` (`8`): start one of the nine drills; *Skip 10 min* or `16×` in the top bar makes the agents' work visible in a minute.
- `AI agents` (`4`): set each of the nine agents to *Advise*, *Approve* or *Auto*; open any decision for its evidence, the options it simulated on the two-hour forecast, the agents' discussion and the audit ID.
- `What-if lab` (`7`): run up to three options against the live plan over 2, 4 or 8 hours; publish one of the Scheduling agent's drafts.
- `Time machine` (`M`): replay machine states, vehicles and readouts of the last 45 plant minutes; *Open the What-if lab* compares options from now.
- `Ask copilot` (`C`): local mode reads the plant in the browser; Claude mode uses your own Anthropic API key (tool use, streaming, every change waits for your approval).
- Deep links: `app.html#st:SMD4-MounterB`, `#line:ML3`, `#buf:PBA:PBA-55`, `#order:<id>`; every detail panel has *Open in 3D*.
- `Space` pause · `T` light / dark · `P` send to deck · `1`–`9` switch views.

Suggested live moment: start *Short shots on injection machine IM10*, press *Skip 10 min*, and watch the Quality agent trace the rejects
to IM10 and simulate the options. Open the decision under **Needs you**, let the guest apply it, then open **Leadership**.

The command room and the live 3D plant run the same model of Plant EG-01: the engine, the enterprise layer and the nine agents in
`assets/js/plant/`. Each page runs its own copy from the same seed, so both open on the same shift.

## Design

Direction, tokens and the reasons behind them: `PRODUCT.md`, `DESIGN.md`, `docs/ALLOWANCES.md`. Design changes go through the
reusable pipeline in `design-pipeline/` (installed into `.claude/skills/`).

## Run locally

Open `index.html` in a browser, or serve the folder: `python3 -m http.server`.

## Deploy

`.github/workflows/pages.yml` uploads the site as a Pages artifact and deploys it on every push to `main`
(Settings → Pages → Source: **GitHub Actions**).

## Structure

```
assets/kit/       Brand UI kit: brand-ui.css, fonts.css (Inter, IBM Plex Sans Arabic), icons.js
assets/css/       theme.css (tokens, theme, motion) · site.css · app.css · deck.css · guide.css
assets/js/        theme.js · motion.js · deck.js
                  twin-hero.js (SMD line 4 drawn live on the website and title slide) · site.js
                  briefing.js (the deck's live briefing) · review.js (time-window review and PowerPoint export) · guide.js · guide-terms.js (glossary and icon list for the guide)
assets/img/       open-licence factory photos, credits in assets/img/CREDITS.md
assets/js/plant/  engine (unit-level plant model) · erp (SAP, GMES, S&OP, MRP, departments) · agents (AI crew, flow-model forecast) · scene (three.js view) · views2d (2D tabs) · ui (panels, drills, tour) · recorder + record-page (flight recorder) · sample-shift.worker
assets/vendor/    three.js r170, bundled once (see assets/vendor/three/README.md)
assets/js/room/   the command room on the plant model: core · viz (SVG charts) · floor (plant mimic and detail panel) · command (value stream,
                  decisions) · ops (alarms, control) · intel (agents, predictions, root cause, what-if lab, drills) · perf (leadership,
                  maintenance, quality, energy) · briefing (feeds the deck) · copilot (local and Claude modes) · main (boot, time machine)
```

Motion and quality checks follow the Animation studio's web method (`coolman1984/animation`): reveals, word-by-word headlines,
reduced-motion support, and a browser check at 390 / 820 / 1440 px for overflow, contrast and hidden content.

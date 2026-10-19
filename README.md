# Digital Factory

A live digital twin, AI agents and a production copilot for electronics manufacturing. Prepared for the client plant.
Static web app: no install, no server, works offline. Light and dark themes, built on the the client UI kit (`assets/kit/`).

| Page | What it is |
|---|---|
| `index.html` | Website: the vision, the client's 2030 direction, the capabilities and the 12-week pilot |
| `app.html` | **Command room**: live plant floor, AI agent crew, alarms, control, predictions, root cause, scenarios, leadership, maintenance, quality, energy, what-if, copilot |
| `deck.html` | **Presentation**: 17 slides with the live demo embedded, an editable business case and speaker notes |
| `docs/RESEARCH.md` | Research brief on the world's best factories, with sources, and the ideas built from it |

All plant data is simulated. the client is named as the audience only; no the client artwork is used.

## Presenting

**Presentation** (`deck.html`): `←` `→` or a clicker · `T` light / dark · `F` full screen · `N` speaker notes.

**Command room** (`app.html`):
- `Scenarios` (or `7`): run one of ten real-world drills, or leave *Auto-play story* on.
- `AI agents` (`4`): set each agent to Advise, Approve or Auto, then watch the audit trail.
- `Time machine` (`M`): replay the last minutes of the plant.
- `Ask copilot` (`C`): "Summarize this shift", "Will we hit the plan?", "Write the shift handover".
- `T` light / dark · `1`–`9` switch views.

Suggested live moment: run *Bearing wear on Mounter B*, wait about 15 s for the prediction, and let the guest click
**Schedule repair**. Then open **Leadership**.

## Run locally

Open `index.html` in a browser, or serve the folder: `python3 -m http.server`.

## Deploy

`.github/workflows/pages.yml` copies the site to the `gh-pages` branch on every push to `main`; GitHub Pages serves that branch
(Settings → Pages → Deploy from a branch → `gh-pages` / root).

## Structure

```
assets/kit/       the client UI kit: brand-ui.css, fonts.css (Inter, IBM Plex Sans Arabic), icons.js
assets/css/       theme.css (aliases, theme, motion) · app.css · deck.css
assets/js/        sim.js (plant engine: lines, alarms, agents, forecasts, scenarios, history) · charts.js · theme.js · motion.js · deck.js
assets/js/app/    core · floor · command · intel (agents, alarms, predictions, root cause, scenarios, control) · perf · copilot · main
```

Motion and quality checks follow the Animation studio's web method (`coolman1984/animation`): reveals, word-by-word headlines,
reduced-motion support, and a browser check at 390 / 820 / 1440 px for overflow, contrast and hidden content.

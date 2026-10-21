# Digital Factory

Static site (no build): `index.html` (website), `app.html` (command room), `deck.html` (presentation), `guide.html` (bilingual reference guide), `plant.html` (live plant in 3D). Plant data is simulated.
When a screen, scenario, decision, slide or term changes, update `guide.html` (both languages) and `assets/js/guide-terms.js` to match.
The command room runs one deterministic twin (`assets/js/twin/engine.js`) through the hub (`assets/js/twin/hub.js`); its agents and copilot
live in `assets/js/agents/`, the room in `assets/js/room/`. Change that twin only through commands (`Twin.exec`), never by writing to the
world from a page, or tabs, saved visits and the time machine drift apart. The live plant (`plant.html`) is a separate model:
`assets/js/plant/` (engine, erp, agents, scene, views2d, ui, recorder).
Design is the brand UI kit in `assets/kit/` (pinned brand: Inter, brand blues, light and dark). The plant is fictional (Plant EG-01);
never name a real company or city for it.

## Design work
For any change to how a page looks, moves or reads, follow the `web-design-pipeline` skill in `.claude/skills/`
(taste-skill + ui-ux-pro-max + impeccable + browser QA). Gate before shipping:

```bash
node .claude/skills/web-design-pipeline/scripts/qa.mjs index.html app.html deck.html plant.html --theme-key df-theme
node .claude/skills/web-design-pipeline/scripts/qa.mjs guide.html --theme-key df-theme   # long page: its probe can exceed the 30 s CDP timeout
.claude/skills/impeccable/scripts/impeccable detect index.html app.html deck.html guide.html plant.html assets/css
```
Recorded design allowances: `docs/ALLOWANCES.md`. The reusable installer lives in `design-pipeline/`.

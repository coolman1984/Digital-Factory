# Digital Factory

Static site (no build): `index.html` (website), `app.html` (command room), `deck.html` (presentation). Plant data is simulated.
Design is the Samsung UI kit in `assets/kit/` (pinned brand: Inter, Samsung blues, light and dark). Samsung is the audience only;
never add Samsung artwork.

## Design work
For any change to how a page looks, moves or reads, follow the `web-design-pipeline` skill in `.claude/skills/`
(taste-skill + ui-ux-pro-max + impeccable + browser QA). Gate before shipping:

```bash
node .claude/skills/web-design-pipeline/scripts/qa.mjs index.html app.html deck.html --theme-key df-theme
.claude/skills/impeccable/scripts/impeccable detect index.html app.html deck.html assets/css
```
Recorded design allowances: `docs/ALLOWANCES.md`. The reusable installer lives in `design-pipeline/`.

# web-design-pipeline

A reusable, world-class web design process for Claude Code (and other Agent Skills tools), built from three open-source
skills plus a real-browser quality gate:

| Skill | By | Licence | Role in the pipeline |
|---|---|---|---|
| [taste-skill](https://github.com/Leonxlnx/taste-skill) (`design-taste-frontend`) | Leonxlnx | MIT | Art direction from a 247-site award study, anti-generic house style, real open-licence pictures, look-and-fix inspector |
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Next Level Builder | MIT | Design-system and UX rule database (styles, palettes, type pairs, 119 UX rules, charts, stacks) |
| [impeccable](https://github.com/pbakaus/impeccable) | Paul Bakaus | Apache-2.0 | Product context, modes, craft floor, audit/critique/polish/animate playbooks, 61-rule AI-slop detector |
| `web-design-pipeline` (this folder) | — | — | The order of work, conflict rules, and `qa.mjs`: phone/tablet/desktop × light/dark browser testing |

## What it does for every website
0. Protects what already works (baseline screenshots and a list of features and data to preserve).
1. Reads the brief and picks the right mode (persuade, operate, read, experience).
2. Researches award-level references (taste study + live galleries, free).
3. Picks a distinctive direction tied to the subject, not the category default.
4. Writes one design system (tokens for light and dark, AA-safe colours, type scale, motion).
5. Builds responsive, production-ready pages.
6. Adds purposeful motion that respects reduced-motion settings.
7. Tests in a real browser at 390, 820 and 1440 px in both themes, plus the AI-slop detector and taste lint.
8. Looks at the screenshots, fixes defects, re-tests (max two rounds).
9. Audits accessibility, performance and usability; checks nothing that worked before broke.
10. Reports in plain words with numbers and what was not verified.

## Install
```bash
./install.sh                       # every project on this machine (~/.claude/skills)
./install.sh --project /path/to/site   # one project; commit .claude/skills so cloud sessions have it too
```
Windows: `.\install.ps1` or `.\install.ps1 -Project C:\path\to\site`.

Requirements: git, Node 22+, Python 3, Chrome / Edge / Chromium. No paid APIs. The impeccable engine is downloaded once
from its GitHub releases and verified against its SHA-256 checksum; its anonymous usage telemetry is switched off.

## Use
Just ask Claude to build, redesign, polish or review a website. The `web-design-pipeline` skill runs the stages and calls
the other three. Direct checks you can run yourself:
```bash
node .claude/skills/web-design-pipeline/scripts/qa.mjs index.html about.html --out .design-pipeline/qa
.claude/skills/impeccable/scripts/impeccable detect .
```

## Updating the three skills
`pipeline.lock.json` pins each upstream commit. `./install.sh --latest` fetches the newest versions and prints the new
pins; test on one project, then update the lock file.

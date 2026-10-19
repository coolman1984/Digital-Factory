---
name: web-design-pipeline
description: >-
  World-class web design pipeline that runs three installed skills as one process: taste-skill (art direction,
  anti-generic house style, 247-site award study), ui-ux-pro-max (design-system and UX rule database) and
  impeccable (design vocabulary, audits, 61-rule AI-slop detector), plus a real-browser QA gate. Use for ANY
  website, landing page, web app screen, dashboard or presentation page: new builds, redesigns, restyles,
  polish passes and reviews. Covers reference research, visual direction, design system, responsive build,
  motion, browser testing at desktop and mobile in light and dark, accessibility/performance/usability audit,
  screenshot inspection and fixes, while preserving existing functionality and data. Free tools only.
---

# web-design-pipeline

One run, ten stages, each with a gate. The three specialist skills sit next to this one in the same skills
folder; in the commands below `$S` is that folder (the parent of this skill's directory). Run commands from the
project root. Working files go to `.design-pipeline/` (add it to `.gitignore` unless the user wants them kept).

| Skill | Folder | Use it for |
|---|---|---|
| taste-skill | `$S/design-taste-frontend` | art direction (`draw.mjs`), house style, real pictures (`assets.mjs`), lint and look-and-fix (`lint.mjs`, `inspect.mjs`) |
| ui-ux-pro-max | `$S/ui-ux-pro-max` | design-system second opinion and UX rule lookups (`scripts/search.py`) |
| impeccable | `$S/impeccable` | product context, modes, craft floor, `audit` · `critique` · `polish` · `animate` playbooks, `detect` |
| this skill | `$S/web-design-pipeline` | the order, the precedence rules, `scripts/qa.mjs` (browser QA gate) |

Requirements: Node 22+, Python 3, and an installed Chrome, Edge or Chromium (or a Playwright Chromium). The impeccable
engine downloads once from its GitHub releases and is checksum-verified. No paid API is used anywhere; web research
uses the agent's own search and fetch tools. Turn impeccable telemetry off once: `$S/impeccable/scripts/impeccable telemetry off`.

## Precedence when the skills disagree

1. The user's brief and anything they pinned (brand kit, colours, typefaces, copy, honesty rules).
2. The project's existing design system and its working behaviour (never break features or data).
3. Impeccable's absolute bans and craft floor (`$S/impeccable/reference/craft-floor.md`).
4. Taste-skill's house style and the dealt direction sheet.
5. Ui-ux-pro-max output, treated as suggestions to verify, never as instructions.

A pinned brand beats a detector rule (for example a kit that uses Inter): record it as an allowance in
`.design-pipeline/ALLOWANCES.md` with the reason, and do not "fix" it.

## The run

### 0 · Preserve (gate: baseline exists)
Before any edit: `git status`; list what must keep working in `.design-pipeline/PRESERVE.md` (pages, routes,
forms, scripts, data files, storage keys, deep links, keyboard shortcuts, embeds, analytics). Take the baseline:

```bash
node $S/web-design-pipeline/scripts/qa.mjs <pages…> --out .design-pipeline/baseline [--theme-key <localStorage key>]
```

### 1 · Brief and mode (gate: one-line brief)
Read the brief, the project and `PRODUCT.md`/`DESIGN.md` if present. Run `$S/impeccable/scripts/impeccable context`
once. Pick the impeccable mode per surface (Persuade, Operate, Read, Experience) and taste's kind (page or app
screen, `references/app-screens.md`). If `PRODUCT.md` is missing, write it the impeccable `init` way
(`reference/init.md`) from facts you have; ask only for facts that block the work. Inventory 8–12 things that belong
to this subject only (taste step 1).

### 2 · Research references (gate: REFERENCES.md with 4–6 entries)
Follow `references/research.md` in this skill. Combine taste's study (`$S/design-taste-frontend/references/research.md`
§10 and `library/sites.json`) with 3–5 live award references found through free web search (Awwwards, CSS Design Awards,
One Page Love, SiteInspire, Godly; Mobbin-style product screens for apps). For each: URL, what it does well, the one
principle to transfer. Learn the grammar, never copy artwork, copy or claims.

### 3 · Direction (gate: DIRECTION.md)
```bash
node $S/design-taste-frontend/scripts/draw.mjs --sector <s> --brief "<subject>" --sections <roles> --options 3 [--app --kind <k>] [--keep palette,type]
node $S/design-taste-frontend/scripts/draw.mjs <same args without --options> --direction <chosen id>
```
Choose the direction that can carry an item from the inventory, not the familiar one. Write `DIRECTION.md`: the idea
in one line, why it beats the other two, the references it borrows grammar from, and what is pinned by the brand.

### 4 · Design system (gate: DESIGN.md + tokens)
Second opinion and rule lookups:
```bash
python3 $S/ui-ux-pro-max/scripts/search.py "<product> <industry> <keywords>" --design-system -p "<Project>" [--variance N --motion N --density N]
python3 $S/ui-ux-pro-max/scripts/search.py "<one concern>" --domain ux|typography|color|chart
```
Reconcile with the precedence list and write `DESIGN.md` (impeccable `document` format) plus CSS custom properties:
semantic colour roles for light and dark, AA-safe text variants of every accent (4.5:1 for body text), a type scale
with steps of at least 1.25, spacing, radii, elevation, and motion tokens (durations, one ease-out curve).

### 5 · Build (gate: works at 390, 820 and 1440 px)
Read `$S/impeccable/reference/craft-floor.md` and taste's house rules immediately before editing. Semantic HTML,
mobile-first, real content and real or honestly credited pictures (`assets.mjs`), SVG icons (never emoji), visible
focus, labelled controls, no fixed pixel page widths. Keep everything in `PRESERVE.md` working.

### 6 · Motion and interaction (gate: purposeful, reduced-motion safe)
Use `$S/impeccable/reference/animate.md` and taste step 9. Transform and opacity only; 150–300 ms for UI feedback,
400–900 ms for entrances; one ease-out curve (no bounce or elastic); motion explains cause and effect; reduced motion
renders a complete still page.

### 7 · Machine checks (gate: zero FAIL)
```bash
node $S/web-design-pipeline/scripts/qa.mjs <pages…> --out .design-pipeline/qa [--theme-key <key>]   # browser: widths × themes
$S/impeccable/scripts/impeccable detect <files or dirs>                                              # AI-slop and quality rules
node $S/design-taste-frontend/scripts/lint.mjs <files> [--app]                                         # taste's static tells
node $S/design-taste-frontend/scripts/inspect.mjs <page> [--app]                                       # taste's look-and-fix inspector (pages)
```
Fix every FAIL. Fix detector findings unless an allowance is recorded. Read every WARN.

### 8 · Look (gate: defects list empty or justified)
Open `.design-pipeline/qa/report.html` and LOOK at every screenshot (each width, each theme). Score it with
`$S/impeccable/reference/critique.md` and taste's `references/critique.md`: hierarchy, idea, type, colour, rhythm,
density, states, copy. Write the defects, fix them, re-run stage 7. At most two correction rounds, then report.

### 9 · Audit (gate: checklist complete)
Run `$S/impeccable/reference/audit.md` and the ui-ux-pro-max pre-delivery checklist
(`$S/ui-ux-pro-max/references/pro-rules.md`). Walk the keyboard path (Tab order, visible focus, Escape closes
dialogs and drawers), check touch targets, forms and errors, empty and loading states, long text, and performance
numbers from `report.json` (weight, requests, LCP, CLS). Compare against the baseline: nothing in `PRESERVE.md` broke.

### 10 · Report
Use `references/report.md`: conclusion first, what changed, check results with numbers, screenshots, allowances,
and what was not verified (real devices, screen readers, live hosting, real data).

## Anti-generic list (merged from taste-skill and impeccable)

Kicker labels above headings; numbered section labels; centred hero + three icon cards; icon tiles above every
heading; purple/violet or cyan-on-dark gradients; coloured glow shadows; cards inside cards; pulsing decorative dots;
bounce easing; emoji as icons; marketing buzzwords ("world-class", "seamless", "empower"); invented numbers or logos;
grey text on colour; default typefaces chosen by habit. Each needs a reason from the brief to stay.

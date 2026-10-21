# Design system: Digital Factory

Built on the brand UI kit (`assets/kit/`). This file records the layer on top. Tokens live in `assets/css/theme.css`.

## Colour roles
| Role | Light | Dark | Use |
|---|---|---|---|
| ground `--bg` | #F2F4F7 | #0A0B0F | page |
| surface `--surface` | #FFFFFF | #14161C | panels |
| ink `--text` | #0F1115 | #F2F4F7 | text |
| muted `--text-2` | #4A5160 | #B6BDC9 | secondary text (AA) |
| accent `--brand` | #1428A0 | #1428A0 | colour fields, primary action fill (light) |
| action `--action` | #1428A0 | #1565D8 | primary button fill, white text ≥ 5:1 |
| live `--brand-2` | #2189FF | #2189FF | drawings, charts, large type only |
| AA text accents | `--brand-text` `--success-text` `--warning-text` `--danger-text` | | small coloured text |
| andon | success / warning / danger kit colours | | machine state only |

No gradients on surfaces, no coloured shadows, no violet. Indigo `--indigo` (#3B4CCA / #8C9BFF) replaces the old violet in charts.

## Type (Inter, pinned by the kit), ratio ≥ 1.25
`--t-sm` 13px · `--t-body` 17px · `--t-lg` 22px · `--t-h3` clamp(28, 2.6vw, 36) · `--t-h2` clamp(40, 5vw, 72) · `--t-display` clamp(44, 7.2vw, 116). Display tracking −0.045em, leading 0.95.

## Space, radius, elevation
Section rhythm `--section` clamp(96px, 12vw, 176px). One radius for media and fields: `--r` 24px (kit `--radius-lg`); buttons keep the kit pill. Elevation: none at rest; `--shadow-lg` only for overlays (dialogs, drawers).

## Motion
One curve `--ease-out` cubic-bezier(.22, 1, .36, 1). UI feedback `--dur-ui` 200ms; entrances `--dur-in` 700ms; the signature shutter 1100ms (hero twin only). Transform, opacity and clip-path only. Reduced motion shows the finished page.

## One grammar on three surfaces
The website sets the grammar; the presentation and the command room follow it.
- **Presentation.** Ink headlines with a muted second clause (`--text-3`). Content in ruled columns (2px ink rule, heading, short text), never icon-tile cards. Colour-field slides (`.tone-blue`, `.tone-ink`) redefine the tokens locally, and the footer, rail and page ground follow the active field. Real photographs on the situation, solution and team slides. The 12-week plan is the website's proportional bar.
- **Command room (ISA-101).** Flat panels on the ground, no shadows, no icon tiles. A page head per view: the view's name and one live sentence about what the plant needs now. KPIs are one readout strip split by 1px gaps, numbers in ink with a sparkline in the quiet hue and the latest point in the accent. The plant mimic is the twin seen from above at the 3D plant's coordinates: grey halls, stations and conveyors; a running station shows its cycle as a grey hairline (movement without colour); amber frames for slow, starved or blocked, red for stopped, dashed indigo for planned work, an amber dot for a machine that is wearing; brand blue for the selection, the routes and a case's numbered cause path. Colour appears only for an abnormal state (warning, stopped, below benchmark, money at risk); a normal state is ink or a quiet square mark.
- **Charts.** Plain SVG sized to their box (assets/js/room/viz.js): 2px lines, a ~10% wash for P10–P90 bands, hairline grid, one y-axis, a direct label at the end of the series the story is about, dashed rules for limits (red contract or UCL, amber zone C), a crosshair readout on hover and keyboard focus, and a hidden data table. Series take one categorical order validated for colour-blind separation in both themes (light `#2189FF #eb6834 #1baf7a #6250d6`, dark `#3987e5 #d95926 #199e70 #9085e9`); red, amber and green stay reserved for state. Stacked bars keep a 2px surface gap.
- **Agent cases.** A case reads top to bottom as a decision: who opened it and its state, the cause with how sure the agent is, the decision form, the options played forward (value against doing nothing, P10–P90, how often it wins, policy), the comparison chart, then the trace of every step with a quiet icon per kind.

## The live plant (plant.html)
The command room's grammar in three dimensions: a white architectural model with ink edges on the blueprint grid (dark: graphite model, light edges).
Machines, racks and vehicles are neutral; colour appears only for an abnormal state: an amber or red frame on the floor under a machine or a
line-side stock, the andon light, and an amber or red tag above it. Brand blue marks the selected object (corner reticle) and the Flow arrows.
Products keep their real colours at small scale (green boards, kraft cartons, lit test patterns on burn-in) so the plant reads as real.
Readouts on top as one hairline strip, the detail panel on the right, the value stream as a hairline strip at the bottom. One ease-out curve for
camera moves (1.1–1.3 s). Phones: shadows off, lower pixel ratio, readouts and views as horizontal scrollers.

## The guide (guide.html)
A book in the same grammar: a blue cover field, ink chapter rules, ruled tables, one blue. Arabic is the default and reads right to left in
IBM Plex Sans Arabic with zero tracking and 1.9–2.0 leading; English in Inter. `data-lang` on `<html>` shows Arabic, English or both side by side.
Dotted-underlined terms open the side panel of terms (`assets/js/guide-terms.js`); the glossary chapter renders the same data.

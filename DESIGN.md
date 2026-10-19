# Design system: Digital Factory

Built on the the client UI kit (`assets/kit/`). This file records the layer on top. Tokens live in `assets/css/theme.css`.

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

# Design allowances

Findings from the design checks that stay on purpose, with the reason. Everything else the checks raised was fixed.

| Finding | Where | Why it stays |
|---|---|---|
| Overused font: Inter | all pages | Pinned by the brand UI kit the client asked us to use. Distinction comes from scale, weight and the live line, not the face. |
| Pulsing dots | command room: live chip, agent waiting/acting, unacknowledged P1 alarms, copilot typing | Each is tied to a real changing state. Flashing unacknowledged alarms follows ISA-18.2 practice. |
| Plant mimic edge to edge | command room: `.mimic-wrap` | The plant map is a drawing that fills its frame like a 3D view; its zoom buttons and legend carry their own inset. |
| Cramped padding on colour fields | website | False positive: fields have 28px to 56px of inner space; the checker misreads the 12-column grid. |
| Tight leading on display type | website | Display headlines at 0.92–1.0 leading by design; all body text is 1.5–1.7. |
| Small tap targets inside dashboard cards | command room | Dense operator screen; nav, topbar and every primary action are 44px on touch. |
| Gradient scrim on the photo band | website | Only to keep white text legible over the photograph, not decoration. |
| 1px rules on table rows | deck: from/to table, architecture tiers, business-case inputs | Real tables and form rows; lists elsewhere are separated by space only. |
| Backdrop blur on the top bar | command room | One sticky bar, as on the website. |
| Cramped padding on the cover | guide | False positive: the cover's text sits in the page wrap, 16–56px from each edge. |
| Aphoristic cadence | guide | Short definitional sentences are the register of a glossary and a reference book. |
| Long-page probe timeout | guide | The QA probe walks every element of a 290 KB book; run it with a longer CDP timeout (0 FAIL at 390 / 820 / 1440, light and dark). |
| 13px secondary labels | live plant: readout sub-lines, value stream, 3D labels | The same operator-screen density as the command room; every primary number is 18–28px and every control is 44px on touch. |
| Page weight about 2.25 MB; slow largest paint in headless QA | live plant | three.js with its post-processing, environment and control add-ons (820 KB, 235 KB gzipped), the brand fonts and the plant, SAP and view scripts. The QA browser renders WebGL in software, so its LCP (5–9 s) is far above a real GPU; the engine warm-up takes about 1.5 s of it. On this container's software GPU the QA probe at 1440 px misses its 30 s step budget on the plant (on `main` too), so the plant is gated at 390 and 820 px and checked at 1440 px for script errors in English, Arabic and admin mode. |
| 13px secondary labels | command room: readout sub-lines, chart ticks, table sub-lines, case meta | Operator-screen density (ISA-101 overview); every primary number is 18–32px and every control is 44px on touch. |
| Em dashes in readouts | live plant, command room | Used only as the "no value yet" placeholder in readouts and table cells, not in prose. |
| Copilot SDK (212 KB) | command room | Loads only when a viewer switches the copilot to Claude mode. |

| Footnote numbers under 14px | website: superscript source markers | Superscripts are footnote markers; the sources they point to are 14px. |
| Small text on the theme label | deck: "Light" / "Dark" on the theme button | False positive: the label is screen-reader only (`sr-only`); nothing is drawn. |
| Inline glossary links under 44px | guide: term links inside sentences and lists | Links inside running text, the inline exception of WCAG 2.5.8; every control, chip, contents link and footer link is 44px on touch. |
| Page weight about 1.95 MB; slow largest paint in headless QA | showroom | three.js (820 KB), GSAP (73 KB), the add-ons (80 KB) and the 41 KB far model, then the 348 KB full model streams in; PixiJS (840 KB) and the path tracer (208 KB) load only when their studio or button is used. LCP in software WebGL is not a real-GPU figure. |
| Command room weight just over 1.5 MB | command room | The brand fonts are embedded in the kit; the page itself grew by one link. |

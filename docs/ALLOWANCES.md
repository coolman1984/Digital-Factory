# Design allowances

Findings from the design checks that stay on purpose, with the reason. Everything else the checks raised was fixed.

| Finding | Where | Why it stays |
|---|---|---|
| Overused font: Inter | all pages | Pinned by the Samsung UI kit the client asked us to use. Distinction comes from scale, weight and the live line, not the face. |
| Pulsing dots | command room: live chip, AOI 30 fps, agent waiting/acting, unacknowledged P1 alarms, copilot typing | Each is tied to a real changing state. Flashing unacknowledged alarms follows ISA-18.2 practice. |
| Nested cards (2) | deck, maintenance slide | False positive: the coloured bar inside each card is a timeline chart, not a card. |
| Cramped padding on colour fields | website | False positive: fields have 28px to 56px of inner space; the checker misreads the 12-column grid. |
| Tight leading on display type | website | Display headlines at 0.92–1.0 leading by design; all body text is 1.5–1.7. |
| Small tap targets inside dashboard cards | command room | Dense operator screen; nav, topbar and every primary action are 44px on touch. |
| Gradient scrim on the photo band | website | Only to keep white text legible over the photograph, not decoration. |
| Numbered circles on the executive summary slide | deck | They order the argument (opportunity, solution, decision) the speaker walks through. |

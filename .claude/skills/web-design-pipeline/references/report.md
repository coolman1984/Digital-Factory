# Stage 10 · Report template

Write for the person who asked, in their language, conclusion first, plain words.

1. **Result in one sentence** (what now exists and whether it is ready).
2. **What changed**: pages, the direction in one line, the design system in one line.
3. **Checks, with numbers**:
   - Browser QA (`qa.mjs`): verdict, FAIL/WARN counts, widths × themes tested, weight / LCP / CLS per page.
   - Impeccable detector: findings before → after; allowances and why.
   - Taste lint / inspect: result.
   - Accessibility audit: contrast, keyboard path, focus, targets, reduced motion.
   - Preserved functionality: every item in PRESERVE.md re-checked against the baseline.
4. **Screenshots**: attach or link `report.html` and the key captures.
5. **Not verified**: real devices, screen readers, live hosting, real data, anything skipped. Say it plainly.
6. **Next options**: one or two concrete follow-ups, not a list of ten.

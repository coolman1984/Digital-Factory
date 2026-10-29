# TV factory visual reference research — 2026-10-29

Research-only catalog. These are SOURCE PAGE links, not locally downloaded image assets. Verify licenses and image attribution before reuse. Do not confuse PCB manufacturing, panel fabrication and final TV assembly.

| Stage | Reference source | What to study |
|---|---|---|
| End-to-end TV plant | https://nevsedoma.com.ua/en/73251-samsung-plant-in-kaluga-how-tvs-are-assembled-38-photos.html | 38-photo Samsung factory tour: stores, conveyors, manual stations, diagnostics |
| PCB assembly and packing | https://gigazine.net/gsc_news/en/20100706_russian_tv_factory/ | Samsung factory: metal press, solder paste, component placement, inspection, packaging |
| SMT and TV assembly | https://www.dgl.ru/technique/fotoreportaj-s-zavoda-lg-v-rossii-televizory-i-mnogoe-drugoe_6431.html | LG factory: SMT line, placement machines, soldering, board checks, assembly |
| Full assembly sequence | https://mybroadband.co.za/news/business/137790-inside-hisenses-south-african-led-tv-factory.html | Hisense: board installation, back covers, testing, packaging |
| Robot/human assembly | https://www.koreajoongangdaily.com/business/lg-oled-tv-production-is-a-team-effort/10174772 | Gumi OLED TV assembly, robots and quality testing |
| Detailed assembly and testing | https://www.digitaltrends.com/home-theater/exclusive-tour-of-lgs-manufacturing-and-assembly-lines/ | LG TV conveyor, robotic fastening, dark-room image inspection, packaging |
| Aging test | https://www.koreajoongangdaily.com/business/inside-lg-electronics-oled-operations/11734020 | OLED aging and production |
| Process architecture | https://www.lg.com/content/dam/lge/in/migration/lginvestorrelations/IRPdf/Red-Herring-Prospectus.pdf | Incoming QC, assembly, line QC, outgoing QC and logistics |

## Next steps for Claude Code
1. Visit each source, inspect individual images and collect only legitimately reusable assets; record original URL, author, license, attribution and date.
2. Build an image index with stage, equipment, motion, camera angle, scale cues, accuracy confidence, license and source URL.
3. Target 8–12 useful references per stage: inbound logistics, metal/plastic parts, SMT/PBA, panel/LCM, backlight, assembly, screw fastening, firmware, visual/audio QC, burn-in, packing, finished goods.
4. Map each stage to existing plant.html stations and assets/js/plant/scene, distinguishing upstream supplier manufacturing from operations physically represented in Plant EG-01.
5. Do not download copyrighted images into public assets without explicit reuse rights; link them for internal reference instead.
6. Keep this branch isolated; do not merge or deploy.

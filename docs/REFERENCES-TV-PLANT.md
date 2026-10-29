# How a real TV plant looks: references for modelling Plant EG-01

Owner direction, 2026-10-29: the plant must not look like one shape repeated. Each area of a TV plant looks and works
differently, and the models must follow real plants (Samsung, LG, Hisense and the other big makers): real equipment from
outside, real components inside. This file records what the owner described, what research found, where it came from, and
what each area should look like when it is rebuilt in Blender (`docs/BLENDER-PLAN.md`).

**Rights.** Photos and videos linked here belong to their owners (Getty Images, news sites, the makers' channels). They are
references to study, never assets to copy into the product. Our models stay original and our plant stays fictional (no real
company or city named for it).

**Access.** This cloud session can search the web but cannot open most pages or download pictures: the network policy
denied digitaltrends.com, koreatimes.co.kr, koreajoongangdaily.com and opeetv.store. Everything below comes from search
summaries; the pictures themselves have not been viewed yet. To let an agent look at them, allow those hosts (or a wider
network level) in the environment's network settings, or ask an agent that can browse (Grok, through the shared mailbox).

## 1. The flow the owner described (the brief)

1. **Sub-assembly cells.** Workers stand one behind another in small square cells. Components come to each worker; they
   fit them and fasten them with screws. These are cells, not one straight line.
2. **Main line.** The sub-assemblies then join a straight moving main line.
3. **Inspection.** Several test and inspection stations on the line.
4. **Packing.** The finished TV goes into its carton.
5. **Warehouse.** Finished cartons are stacked on pallets, the pallets are shrink- or stretch-wrapped, stored, and loaded
   into shipping containers.
6. **Every area different.** Many kinds of places inside the plant; never the same shape everywhere.

## 2. What research found

| Topic | Finding | Source |
|---|---|---|
| Line structure | A complete TV line is a main assembly line, a testing line, a repair line, an aging line and a packing line, often on O-shaped speed-chain (double-speed chain) conveyors | [bossgoo, SKD TV line with aging](https://www.bossgoo.com/product-detail/skd-tv-assembly-line-with-aging-54875946.html) |
| Stations | PLC-controlled pallet conveyor with a pallet stopper at each station; a two-row aging section | [Sanhok, TV assembly line](https://sanhokgroup.com/tv-assembly-line/) |
| Aging | Sets ride pallets standing or lying flat through aging, or move to separate aging trolleys or racks | [SZ Assembly Line](https://www.szassemblyline.com/skd-lcd-tv-led-tv-asssembly-line-with-pallets-product/) |
| LG Gumi (the mother plant) | A 140 m conveyor: about 30 m of assembly, then a 60 m inspection area with accelerated aging. New processes are proven at Gumi, then sent to plants abroad | LG Gumi reports summarised in search: [Korea Times 2016](https://www.koreatimes.co.kr/business/tech-science/20160606/thorough-inspection-brings-perfection-to-lgs-oled-tv), [JoongAng Daily](https://www.koreajoongangdaily.com/business/inside-lg-electronics-oled-operations/11734020), photo tour [Digital Trends](https://www.digitaltrends.com/home-theater/exclusive-tour-of-lgs-manufacturing-and-assembly-lines/) |
| Assembly order | Fix the shell, install the panel, install the main board, install the speakers, inspect, add accessories, pack | [OpeeTV, TV manufacturing process](https://www.opeetv.store/article-en/tv-manufacturing-process/) |
| Backlight | LED strips fixed in the rear casing; diffuser, prism and brightness films laminated over them; often robot-placed | [OpeeTV](https://www.opeetv.store/article-en/tv-manufacturing-process/), [SuccessLCD module process](https://successlcd.com/tft-lcd-module-manufacturing-process/) |
| Panel and backlight matching | Robot arms with cameras identify the glass and the backlight module and match them | [TPV intelligent manufacturing](https://www.tpv-tech.com/en/smart-zz.html) |
| Open cell | A bare LCD panel with no backlight, case or electronics; it must be paired with its backlight unit, with alignment pins and screw holes matching | [Alibaba open-cell guide](https://electronics.alibaba.com/buyingguides/open-cell-tv-repair-guide-for-diy-tech-users), [SuccessLCD](https://successlcd.com/tft-lcd-module-manufacturing-process/) |
| Test booths | Dark-room booths for screen calibration (white balance) and noise-suppressed booths for the audio check | [Hongdali via EIN Presswire](https://www.einpresswire.com/article/923842104/advanced-manufacturing-edge-from-a-high-quality-tv-production-line-system-supplier) |
| Cells | Samsung's production system mixes cell production (one-person cells; block cells of four to eight people) with modular lines; documented for phones | [Nguyen 2024, Samsung production system](https://www.management-poland.com/pdf-185638-107311?filename=A-Samsung-production-syst.pdf) |
| U-cells feeding a line | U- and I-shaped sub-assembly cells feeding a short I-shaped final line; material enters one side of the U and leaves at the other | [U-shaped cell layout](https://www.tryharmony.ai/u-shaped-cell-layout), [TXM layouts](https://txm.com/factory-layout-examples/) |
| End of line | Carton erecting, packing, sealing, strapping, palletizing, stretch wrapping; hood film as the alternative | [CSTRANS end-of-line](https://www.csfpack.com/news/end-of-line-packaging-build-a-fully-automated-post-production-line-with-cstrans-372716.html), [AFA playbook](https://www.afasystemsinc.com/wp-content/uploads/2019/10/Playbook-End-of-Line-Equipment-2013.pdf) |
| TV cartons | Cartons must survive stacking, forklifts and sea-freight vibration; pallet patterns follow the container | [POZI Packaging](https://www.pozipackaging.com/product/tv-cardboard-boxes/) |
| Containers | A 40 ft high cube holds about 76 m³; plan 85–90 % fill; about 21 US pallets on the floor | [CBM calculator](https://www.cbmcalculator.com/blog/how-many-cbm-in-a-shipping-container-20ft-40ft-40hc/), [Conexwest](https://www.conexwest.com/blog/how-many-pallets-fit-40ft-container) |
| Inside the TV | Main board with processors and heat sinks, a power board, ribbon cables to the backlight, LED strips; the T-con board under a metal cover | [Digitec teardown](https://www.digitec.ch/en/page/tv-teardown-huh-just-plain-old-led-strips-14307), [iFixit T-con guide](https://www.ifixit.com/Guide/Samsung+LED+TV+LE37A659+(and+similar+models)+T-Con+Board+Replacement/127143) |

### Videos to watch (not yet viewed from this session)

- Hisense Qingdao TV assembly, Linus Tech Tips: [youtube.com/watch?v=Cmnfwabz0bA](https://www.youtube.com/watch?v=Cmnfwabz0bA) (back panel assembly, boards, QA; sponsored by Hisense)
- Samsung TV production process: [youtube.com/watch?v=OQ9iitRMPjU](https://www.youtube.com/watch?v=OQ9iitRMPjU)
- How Samsung smart TVs are made: [youtube.com/watch?v=ZNdC2KcHrXU](https://www.youtube.com/watch?v=ZNdC2KcHrXU)
- Smart TV factory tour: [youtube.com/watch?v=VBDDFGXK8k4](https://www.youtube.com/watch?v=VBDDFGXK8k4)
- LCD panel production, glass to display: [youtube.com/watch?v=jp0RRgKTY90](https://www.youtube.com/watch?v=jp0RRgKTY90)
- LED TV SMT line: [youtube.com/watch?v=_onM60n51Ac](https://www.youtube.com/watch?v=_onM60n51Ac)

Licensed still photos (reference only): Getty Images, Samsung Suwon LCD TV line, 2003, and Samsung factory searches:
[gettyimages.ie/photos/samsung-factory](https://www.gettyimages.ie/photos/samsung-factory).

## 3. What each area should look like (modelling brief)

Each line becomes its own set of Blender models. Identical machines are right only where the real plant repeats them:
an SMD line really does run two to four identical placement machines in a row, but no two areas of the plant look alike.

| Area | What a visitor should see | What makes it different |
|---|---|---|
| SMD (main boards) | Loader, printer, SPI, two or three identical mounters, reflow oven, AOI, unloader: closed machines in a clean row, few people | Machines, not people; ESD floor, yellow-and-black lane marks, reel racks |
| Sub-assembly cells | Square or U-shaped cells; three to six operators standing one behind another; part bins and flow racks behind them; electric screwdrivers hanging on balancers; small fixtures | People and hand tools; colour-coded bins; cells turn at right angles |
| Panel and backlight (LCM) | Clean room behind glass walls; LED strips laid in the back chassis; diffuser and films; robot arms with cameras placing the open cell | Clean-room suits, glass partitions, robots, filtered air ducts |
| Main assembly line | Long straight pallet conveyor (speed chain), a stopper at every station, operators on both sides, sets lying face-down on soft pallets, screwdrivers from above, the back cover going on | Long and straight, many people, overhead lighting rails and tool rails |
| Test and inspection | Dark booths for white balance with cameras, sound booths for the speakers, function-test stations with screens lit, a repair loop beside the line | Dark rooms with glowing screens; booths with doors |
| Aging | An O-shaped two-row loop or tall racks of switched-on TVs showing test patterns | A wall of lit screens; heat; a loop, not a line |
| Packing | Carton erector, EPS corners or cushions dropped in, the set lowered in, accessories, sealing and strapping | Cardboard everywhere; conveyor bends; label printers |
| Palletizing and wrapping | Robot or manual palletizing, cartons in a set pattern, stretch-wrapper turntable, pallet labels | A spinning wrapper; stacks of wrapped pallets |
| Finished-goods warehouse | Pallet racks, forklifts and reach trucks, staging lanes by destination | Height: racks to the roof; vehicles, not people |
| Shipping | Dock doors, leveller plates, containers backed in, forklifts loading pallets into a 40 ft high cube | Trucks and containers at the wall |
| Parts plants | Injection machines with moulds and robots, presses with die sets, the powder-coating line, EPS moulding | Heavy, loud, hot; each its own shape |

## 4. How we will use this

1. Watch the videos and study the pictures above (needs network access or a browsing agent) and record, per area, the
   machines, the people, the floor marking, the materials and the light. Write the measurements we can estimate.
2. Model each area in Blender with its own kit of parts (cells, bins, screwdrivers, conveyors, booths, wrappers, racks),
   with stable part ids, as Mounter B was done; keep a light floor version and a full studio version of each.
3. Place them in the plant by the engine's own layout, area by area, and compare our renders side by side with the
   references for each area. Nothing ships as "realistic" until that comparison has been made and recorded.

# How a real TV plant looks: references for modelling Plant EG-01

Owner direction, 2026-10-29: the plant must not look like one shape repeated. Each area of a TV plant looks and works
differently, and the models must follow real plants (Samsung, LG, Hisense and the other big makers): real equipment from
outside, real components inside. This file records what the owner described, what research found, where it came from, and
what each area should look like when it is rebuilt in Blender (`docs/BLENDER-PLAN.md`).

**Rights.** Photos and videos linked here belong to their owners (Getty Images, news sites, the makers' channels). They are
references to study, never assets to copy into the product. Our models stay original and our plant stays fictional (no real
company or city named for it).

**Access.** The owner opened the session's network on 2026-10-29. Pages and pictures can now be fetched with curl
(the WebFetch tool still refuses some hosts); YouTube refuses video downloads without a signed-in browser, so only its
thumbnail frames were seen. Wikimedia Commons rate-limited the session. A request for more pictures went to Grok through
the shared mailbox (`inbox/grok/2026-10-29-1512-claude-tv-plant-reference-photos.md`).

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

## 2b. What the pictures show (seen 2026-10-29)

**LG Gumi TV plant, nine photos** in the [Digital Trends tour](https://www.digitaltrends.com/home-theater/exclusive-tour-of-lgs-manufacturing-and-assembly-lines/)
(photos credited in the article; studied, not copied):
- Sets are assembled **lying face down** on a blue- or green-matted belt; the operator stands beside it at hip height and
  drives the main-board screws with an electric screwdriver (green bit) into the galvanised back chassis.
- Above every station stands an **aluminium-profile frame** carrying a monitor (work instructions or test output), a blue
  LED task light, a digital counter, balancers and a lot of cable. The frames repeat down a long straight line.
- Further on, the sets **stand upright** on the conveyor for test: rows of lit panels with test patterns (colour bars,
  "Power only" white fields, green fields), cables plugged into the back, an operator in front of each test station.
- Operators wear their own clothes (blue, black, red, grey) with a **light-blue apron**, gloves and sleeve covers.
- Floor: light epoxy, **green ESD mats** along the line, **yellow lane lines** marking the aisle; white parts shelves along
  the line side; bright white ceiling light.
- The article: the conveyor runs "straight as an arrow" for about a quarter mile; screens drop from the ceiling to the
  stations; a machine sorts screws one at a time down a chute; dark rooms check the picture; finished sets are left
  running for days in a separate room; packing ranges from "drop it in the box" to several pairs of hands.

**Factory-tour thumbnails** (YouTube frames): sets face down on green padded pallets with cartons of parts beside the
line ([smart TV factory tour](https://www.youtube.com/watch?v=VBDDFGXK8k4)); tilted test sets on a green line; a six-axis
robot with a vacuum gripper handling a panel ([Samsung smart TV video](https://www.youtube.com/watch?v=ZNdC2KcHrXU));
two people lifting a bagged set. **Not used:** the "world's biggest Samsung TV factory" video
([OQ9iitRMPjU](https://www.youtube.com/watch?v=OQ9iitRMPjU)) shows clearly AI-generated frames; it is not a reference.

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

## 5. Reference-to-model matrix (the vertical slice)

Confidence: **H** seen in several photos, **M** seen once or described in text, **L** our inference. Dimensions are
estimates from people's height (about 1.7 m) and a 65-inch set (1.45 × 0.84 m).

| Station | Equipment | Workpiece orientation | Approx. dimensions | Operator posture and tools | Material in / out | Conveyor and fixture | Safety envelope | Views | Confidence | Sources |
|---|---|---|---|---|---|---|---|---|---|---|
| U-shaped sub-assembly cell | Three benches in a U, ESD tops, overhead light and balancer frame, flow racks outside the U | Brackets and boards flat on the bench | Bench top 0.85–0.9 m, U about 2.6 × 2.4 m | Standing, one behind another, hands at bench height; electric screwdriver laid down or on a balancer | Parts slide in from flow racks fed from the aisle; kits leave on a roller conveyor to the line | Short roller conveyor with beige rollers | Aisle kept clear; no moving machinery | Overview, eye level from the aisle | M (cells: Samsung production system paper, lean literature; benches and rollers: Kaluga photos) | Nguyen 2024; TXM; Kaluga tour (nevsedoma) |
| Main line, manual station | Conveyor (LG: padded pallets on a belt; Samsung: beige plastic rollers), lean-tube frame over the line, yellow spring balancers, electric screwdrivers, white monitor, test generator, stack light, task light | Set face down, back chassis up | Conveyor top 0.8–0.85 m; station pitch about 2 m; frame top about 2.2 m | Standing beside the line, gloves, sleeve covers, blue uniform; driver pulled down from the balancer | Boards, speakers, cables, back cover from bins and flow racks; set moves on | Stoppers at stations (LG pallets) or a continuous roller bed (Samsung) | Pinch points at stoppers; nothing above head height but balancers | Eye level, detail of the driver on the board | H | LG Gumi (Digital Trends); Kaluga tour |
| Robot fastening station | Six-axis robot with a screwdriver tool | Set face down | Robot reach about 1 m over the pallet | Operators place parts upstream; robot fastens | Placed parts in, fastened set out; a scanner checks for missing parts | Same conveyor | Light curtain or guard around the reach (our inference) | Detail | M (described at Gumi; robot frames in tour thumbnails) | JoongAng Daily; tour thumbnails |
| Functional test | Upright test conveyor, fixtures holding the set, signal cables, monitor and generator | Set standing, screen to the operator | Set top at 1.6–1.8 m | Standing in front, reading the screen, remote or keyboard | Assembled set in, tested set out; failures to the repair loop | Belt or rollers with upright fixtures | Low risk; cables | Eye level | H | LG Gumi photos; Kaluga test patterns; Korea Times |
| Packing | Roller conveyor, open carton, EPS cushions, lift assist or two people lifting a bagged set | Set lowered flat into the carton | Carton about 1.63 × 1.0 × 0.19 m | Two people or a vacuum lift; set in a black protective bag | Bagged set and accessories in, closed carton out | Rollers; taping machine, strapping arch | Lift assist load; strapping head | Eye level, detail | H (Kaluga packing photos), M (lift assist) | Kaluga tour; tour thumbnails; Digital Trends text |
| Taping and strapping | Carton sealer with tape head, strapping arch | Carton flat | Arch about 1.9 m wide | Unattended | Open carton in, sealed and strapped out | Rollers through the machines | Guarded heads | Detail | M | CSTRANS; OpeeTV |

## 6. The Commons gallery, checked (2026-10-29)

`docs/tv-factory-photo-gallery.html` links 15 Wikimedia Commons files. All 15 pages exist; licence, author and date below
come from the Commons API (`extmetadata`). Nine images were opened and looked at; six thumbnails were refused with
HTTP 429 (rate limit) and are judged from their Commons description only (marked *desc*). All are CC BY or CC BY-SA:
reusable with attribution (BY-SA also requires sharing derivatives alike). They are still kept as links, not copied in.

| File | Licence · author · date | What it shows (checked) | Stage | TV-specific? | Use for the model |
|---|---|---|---|---|---|
| Tv Assembly Line 1.jpg | CC BY-SA 4.0 · Digital World Pakistan · 2014 | Operator in gloves fitting boards and brackets into a face-down set on a padded bench | Main assembly | **Yes** | Face-down set on a soft mat, white gloves, small brackets |
| Tv Assembly Line 2.jpg | CC BY-SA 4.0 · Digital World Pakistan · 2014 | *desc*: TV assembly line | Main assembly | Yes (desc) | — |
| Tv Assembly Line 3.jpg | CC BY-SA 4.0 · Digital World Pakistan · 2014 | Picture test: sets on an aluminium-profile bench with green top, colour-bar and grey-scale patterns, operator with a remote | Picture test | **Yes** | Test bench in lean profile, two tiers, pattern screens, remote in hand |
| TV assembly line.jpg | CC BY-SA 3.0 · Rajandatta · 2008 | *desc*: no description | Main assembly | Unknown | — |
| SMT-Bestueckung.jpg | CC BY-SA 3.0 · ECD Dresden · 2011 | SMT line: light-grey placement machines and a reflow oven, overhead exhaust ducts, operator at the line screen, yellow floor line | SMT/PBA | Generic | Exhaust ducts above the reflow, light-grey cabinets, stack lights |
| THT-Bestueckung.jpg | CC BY-SA 3.0 · ECD Dresden · 2011 | *desc*: manual soldering of cables and connectors | THT/manual | Generic | — |
| Juki KE-2080L by Megger.jpg | CC BY 3.0 · Megger Ltd · 2008 | Placement machine front: reel feeders on a trolley, monitor arm, keyboard, e-stop, light tower | SMT/PBA | Generic | Reel trolley at the front, monitor arm, e-stop |
| Pick and place internals of surface mount machine.JPG | CC BY-SA 3.0 · Peripitus · 2007 | Inside a 4-head placement machine: gantry, cable chain, nozzles, feeder bank | SMT/PBA | Generic | Already used for Mounter B (gantry, cable chain, feeder bank) |
| Surface mount component feeder.jpg | CC BY-SA 3.0 · Peripitus · 2007 | One tape feeder with a white reel | SMT/PBA | Generic | Feeder proportions (reel vs body) |
| Machine places components… .jpg | CC BY 2.0 · Shixart1985 · 2026 | Close-up of a dispensing/placement head over a board | SMT/PBA | Generic | Head close-up |
| Samsung CP40CV SMT placement machine in 2004.jpg | CC BY 4.0 · Ossewa · 2004 | A crated placement machine on a pallet outdoors, being installed | Logistics (machine delivery) | No | Not production; ignore for the line |
| Rigging SM482.jpg | CC BY 4.0 · Ossewa · 2025 | A forklift moving a placement machine through a door | Logistics (machine delivery) | No | Forklift proportions only |
| Electronics factory in Shenzhen.jpg | CC BY 2.0 · Steve Jurvetson · 2005 | Long rows of seated operators in clean-room suits at benches | Generic electronics hand assembly | No | Shows seated bench work; TV final assembly is standing at a moving line |
| Depanelization.jpg | CC BY 2.5 · — · — | *desc*: a PCB panel before separation | SMT/PBA | Generic | — |
| PCBA Conformal Coating.gif | CC BY-SA 4.0 · Encik Tekateki · 2023 | *desc*: conformal coating of a phone board | Phone PCBA | No | Not part of a TV plant's own flow; ignore |

Verdict: only two of the fifteen are confirmed TV-plant pictures (assembly on a padded bench, picture test). Seven are
generic SMT or electronics and useful for the SMD lines; four are not production at all. The TV-specific coverage comes
from §2–§5 (LG Gumi, Samsung Kaluga, Hisense, JoongAng), which are linked, not reusable.

**Owner's target pictures (2026-10-29):** an exploded cutaway of a servo gear motor on white (the studio level for
exploded/cut views: real metal, clean section faces, readable internals), a stainless filling machine in a photo studio
(look only; its lens flare and lighting suggest an AI image, so it is not a fact reference), and a MAUSER digital-twin
screenshot (dense real machinery, yellow-post mesh safety fences with door states, live KPI tiles and a part card with
article number and documents). The last one sets the target for the live plant.

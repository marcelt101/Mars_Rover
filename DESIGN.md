# Mars Rover: Design Plan

A co-op browser game for up to 6 players, each on their own device, exploring real places on Mars. You plan commands, send them to Mars, and watch the rovers carry them out.

## Versions

- **v1** (branch `v1`, playable at `/v1/`): single-player Jezero Expedition with three roles.
- **v2** (on `main`, playable at `/game/`): co-op multiplayer, profiles, collecting, perks, Jezero and Gusev.
- **v3** (next): real NASA maps.

## Platform

- Stays in the browser, hosted free on GitHub Pages.
- 2D canvas maps. No build step: plain HTML, CSS and JavaScript.
- Later: installable as an app (PWA) with an icon, fullscreen and offline play.
- Save backup: export/import a save code, so a cleared browser doesn't lose a collection.

## Crew roles

| Role | Ages | How they plan |
|---|---|---|
| **Cadet** | 4–7 | Picture buttons only (↑ ↶ ↷ ⛏). Each arrow is one square. Up to 5 pictures, growing to 8 with rank. Big GO button. Ghost footprints preview the path. No reading, no numbers, no battery, no failure: bumps just wiggle. |
| **Explorer** | 8–12 | Blocks with numbers: drive, turn, scan, analyze, drill, charge. |
| **Specialist** | 13+ | Python with loops; later sensors, `if`/`while` and functions. |

## Multiplayer (up to 6 players)

- **The host's browser is the server.** One player taps *Host game*; the screen shows a room code (e.g. `MARS-4821`) and a QR code. Others tap *Join*.
- Devices connect directly (WebRTC). A free public service (PeerJS) only introduces them at the start; all game traffic stays on the home network. Works outside the home too.
- **Co-op sol:** everyone plans at the same time, presses *Ready*, all plans uplink together, and all rovers move at the same time. Rovers block each other, so the team has to coordinate.
- Host is authoritative: it runs the simulation and sends results to everyone.
- Host device stays awake (wake lock). Dropped players rejoin with the same code and get their rover back; their rover waits that sol.
- Connection check screen to make network problems easy to report.

### Telling rovers apart
- Each player picks a color (body stripe, flag, tracks, planned path, minimap dot, log messages).
- Each rover job has its own shape.
- Small name flag always visible (initial when zoomed far out). Hover (PC) or tap (tablet) shows name, avatar, rank, battery and samples.
- "Who's who" bar of player cards along the map edge; click one to jump to that rover.

### Rover jobs
Scout (bigger scan), Science (better spectrometer), Hauler (more tubes), Excavator (digs out sand traps, clears rocks), Helicopter (Ingenuity: flies over rocks, can't crash; ideal for the Cadet).

## Profiles, progress and rewards

- **Profiles:** name, avatar, rover color and skin. Personal progress is saved on each player's own device.
- **Team progress** (base, unlocked maps) is saved on the host and copied to every player as a backup, so anyone can host next time.
- **Ranks** (XP scaled per role so everyone ranks up at a similar pace): Trainee → Rover Driver → Field Geologist → Science Lead → Mission Specialist → Flight Director.
- **Rewards never use streak pressure, never take progress away, and never rank siblings against each other.**

### Collecting
- **Mineral cards:** 30–40 across all maps, with a real fact each. Rarity: Common, Uncommon, Rare, Legendary. Small chance of a shiny "perfect specimen". Map sets give a gold frame and a patch.
- **Mission patches:** 50+ for skills, firsts, silly moments and team achievements.
- **Rover parts and skins:** paint, wheels, antennas, flags, decals; rare skins (Retro Apollo buggy, Golden Rover).
- **Mars artifacts:** super-rare hidden finds from real history (Beagle 2, Mars Pathfinder, Ingenuity's last landing spot).
- **Postcards:** photos taken at special spots (sunset over Jezero, dust devils, Earth in the night sky).
- **Collection Room:** display cases, patch wall, garage and artifact shelf. Empty slots show as silhouettes.
- Team finds are copied to everyone; personal finds (shinies, patches, skins) belong to whoever earned them. Optional trading of duplicates.
- Cadet gets a treasure-chest opening animation with sounds.

### Real-world prizes
- Printable certificates and patches for ranks.
- Parent-only prize board: real rewards set by a parent, with progress shown in the game.

## Perks

Based on real rover instruments. You own many but equip a limited number per expedition.

| Tier | Perk | Effect | Real thing |
|---|---|---|---|
| Common | Wide wheels | Dunes cost normal power, fewer sand traps | Rover wheel redesigns |
| Common | Dust wiper | Solar panels stay clean longer | Opportunity's wind gusts |
| Rare | SuperCam laser | Analyze up to 3 squares away | Perseverance's 7 m laser |
| Rare | Big battery | +50% battery | |
| Epic | SHERLOC UV scanner | Signals glow by rarity | Perseverance's organics detector |
| Epic | AutoNav | Steers around rocks instead of stopping | Perseverance self-driving |
| Epic | Ingenuity buddy | Mini helicopter scouts 5 squares ahead each sol | Ingenuity's 72 flights |
| Ultimate | **RIMFAX deep radar** | Sees underground: buried ice, fossils, secret artifacts only its owner can find; golden skin | Perseverance's ground-penetrating radar |
| Ultimate | **Nuclear heart (RTG)** | Never runs out of power, ignores dust storms | Curiosity and Perseverance power source |

**Earning:** rank-ups (Common, Rare), collection sets (Epic), big age-appropriate goals (Ultimate): Cadet 100 treasures, Explorer 3 map collections, Specialist a hard coding challenge.

### Fairness by role
| Role | Perk slots | Available |
|---|---|---|
| Cadet | 4 | All gameplay perks, including both Ultimates |
| Explorer | 3 | Up to Epic, plus RIMFAX |
| Specialist | 2 | Up to Rare gameplay perks; no Ultimate gameplay perks |

The Specialist gets **Engineer perks** instead: new code abilities (`rover.sense_ahead()`, `if`/`while`, `def`, a personal AutoNav script that runs every sol). Their ultimate is prestige: the Flight Director title, a unique skin, and setting challenges for the team.

**Team perks** help everyone, e.g. a base radio tower (longer plans) and a greenhouse (faster recharge).

## Maps

Each map adds its own mechanic. Unlocked in order as team milestones.

| # | Map | Mechanic | Real story |
|---|---|---|---|
| 1 | Jezero Crater | Tutorial: scan, analyze, drill | Perseverance |
| 2 | Gusev Crater | Sand traps everywhere; excavator matters | Spirit got stuck here |
| 3 | Meridiani Planum | Huge plains for 6 players; blueberries, meteorites | Opportunity's marathon |
| 4 | Gale Crater | Climbing Mount Sharp: slopes and power | Curiosity |
| 5 | North Polar ice | Finale: water ice, freezing nights, big storms | Phoenix lander |
| ★ | Moon: Hadley Rille | Bonus: Apollo-style buggy, low gravity | Apollo 15 |

Replay: random expeditions on each map, a daily challenge seed, and later a map editor.

## Survival (later update)

Dust on solar panels, cleaning events, cold nights draining the battery, dust storms forecast a few sols ahead, a growing base station, wheel wear, comms windows.

## Status

Built in v2:
1. Profiles and collections: 11 cards with rarity and shiny versions, 24 patches, ranks, inventory on **I**/**E** like Minecraft and Minetest
2. Cadet picture-sequence mode with footprint preview and treasure-chest animation
3. Multiplayer for up to 6: host and join with codes or QR, Ready buttons, chat, drafts of everyone's paths, reconnects, "Start without waiting"
4. Gusev Crater with the Excavator, sand traps and Spirit at Troy
5. Perks: Common and Rare tiers (Wide wheels, Sharp eyes, Better radio, SuperCam laser, High-gain antenna, Big battery)
6. Signal delay of 5–10 s per sol with the stock antenna; radio and antenna perks shorten it

## Improvement batches (from playtesting)

**Batch 1 (done):** bigger map on PC with a big-map mode (M); driving at half speed; movement buttons in a WASD-style cross with other buttons grouped (Science, Tools, Power); PC keys (WASD/arrows, Space, Q/R/G/C, Enter, Shift+WASD camera); guidance (objective hints with Show, search circles and edge arrows, one-tap helpers like Plan route home, fewer sand traps near the station); pacing (10 ranks, 54 stickers, 9 more patches, endless Cadet gems, 4 organic sites, realistic star targets); optional role-matched tutorial.

Robot playtest after batch 1: a beginner following the hints finishes 93% of expeditions (before: 30% on Jezero, 0% on Gusev); the Cadet has no wait longer than 8 minutes between rewards for the first 80 minutes (before: a 48-minute gap); ranks keep coming through 2+ hours.

**Batch 2 (done):** realistic terrain with hillshading (crater bowls with ejecta, delta lobes and strata, dune ridges, hills, Home Plate mesa); Perseverance-style rovers with job gear and visible perks, plus Buggy and Ingenuity; plan stars and coding tips in a sol report, coding patches; tap-the-map planning, team markers, undo, battery estimate; Scout flags with site names, claiming, renaming, discovery credit and the Finds list.

**Batch 2 (original list):** code stars and the coding badge ladder; realistic rovers with visible perks; tap-the-map planning, hint clouds, markers, recipes, sol summary; Scout flags and the Finds list; more realistic generated terrain (hillshading, craters, delta, dunes).

**Batch 3 (done):** team chain (find → drill → lab), Mars Catalog and base upgrades; satellite relay kit (multi-sol programs, blocks for Explorers and Python for Specialists, with mission recipes); gentle weather and forecasts; rover health dashboard (battery, tubes, wheels, dusty panels, temperature, signal, instruments; a simple face for Cadets; the station repairs everything for free); Moon map with the Apollo Lunar Roving Vehicle.

Batch 3 details: the Lab job (team games) catalogs samples, makes water/metal/bricks/glass and builds the radio tower, solar farm, garage and greenhouse. The relay kit unlocks at rank 2: Explorer smart blocks (Repeat, If…, Until full or low battery, Go to signal, Go home, Run for 2 sols) nest 2 levels deep; Specialist Python adds `while`, `if`/`elif`/`else`, `def`, sensors, `go_to_signal()`, `go_home()` and `rover.mission(N)`. Programs run on the rover with a budget of 60 actions per sol; AutoNav re-routes macros around new rocks, stops before collisions, and pauses at low battery. Weather storms are scheduled 2 sols ahead, never before sol 6, about 1 sol in 12.

**Batch 4 (planned): Minerals chart.** A periodic-table-style chart of minerals, as a new Chart tab in the inventory (and from the Mars Catalog). It is a view of the same card collection, not a second one.
- Columns are mineral families instead of element groups: silicates, carbonates, sulfates and salts, oxides, metals (meteorites), organics, Moon rocks. Each square: short symbol (Ol, Cb, Sf), color, name. Unfound squares are dark with a "?" and a hint where to look.
- An element strip underneath (about 12 beginner elements: O, Si, Fe, Mg, Ca, C, S, Cl, Na, Al, Ni, H) lights up as minerals containing them are found. Tap a mineral to see what it is made of; tap an element to see which of your minerals contain it.
- Depth by role: Cadet sees colored squares and pictures; Explorer sees names, families and elements; Specialist also sees simple formulas (like Mg₂SiO₄).
- Small rewards: a patch for each completed family row and one for lighting up all the elements.
- Add 8–10 more real minerals so the chart is worth filling (hematite "blueberries", gypsum veins, jarosite, magnetite, feldspar, perchlorate salts, ilmenite, the Moon's orange soil), some for the future maps. Real science only.

**Batch 4 addition: the 12 "signs of a living Mars" minerals, each with an information tablet.** Real science only. Every tablet shows the mineral's picture and color, a simple formula, where a rover found it (mission and site), which instrument detects it, and "Why scientists care". The text is simpler for Cadets and more detailed for Specialists.

| Mineral | Found by | Why scientists care |
|---|---|---|
| Clay (smectite) | Curiosity (Gale), Perseverance (Jezero delta) | Forms only in long-lasting, gentle, not-too-acidic water. Clay also traps and protects organic molecules for billions of years. |
| Carbonate | Perseverance (Jezero rim), Spirit (Comanche) | Forms from water and carbon dioxide. On Earth, carbonates hold the oldest fossils of microbe mats (stromatolites). |
| Opaline silica | Spirit (Home Plate) | Left by hot springs. On Earth, hot spring silica keeps finger-like shapes made by microbes, and Spirit found very similar shapes. |
| Gypsum | Curiosity (Gale veins), Opportunity | Bright veins show water flowing through cracks in the rock long after the lake dried up. |
| Jarosite | Opportunity (Meridiani) | Forms only in acidic, salty water, so it tells what kind of water was there and when. |
| Hematite "blueberries" | Opportunity (Meridiani) | Little balls that grew in groundwater soaking through the rock. The first proof of past water that a rover touched. |
| Halite and chlorides | Orbiters, Curiosity | Salt left when lakes evaporated, marking where water pooled and dried. |
| Perchlorate | Phoenix (north polar plains) | A salt that keeps water liquid far below freezing. It can also break down organic molecules when rocks are heated, which makes finding them harder. |
| Serpentine | Orbiters (Nili Fossae), Perseverance (Jezero) | Forms when water reacts with olivine, which releases hydrogen. On Earth, microbes deep underground live on that hydrogen. |
| Olivine | Every rover | A clock for water: olivine turns into other minerals quickly in water, so finding fresh olivine shows the rock stayed dry. |
| Manganese oxide | Curiosity (Gale), Opportunity | Needs water with a lot of oxygen. On Earth, microbes often help make it. |
| Vivianite and greigite ("leopard spots") | Perseverance (Cheyava Falls, 2024) | Tiny spots in a mudstone with organic matter. On Earth, reactions like these are often run by microbes. NASA calls it a potential biosignature: the best clue yet, not proof. |

Several of these are already cards (clay, carbonate, silica, olivine, salts). The new ones would be added on the maps where they belong (Jezero, Gusev) or saved for the future maps (Meridiani, Gale, North Polar). The tablet always separates what was found from what it might mean, the same way the scientists do.

**Batch 4 addition: calm space music.** Ambient background music made in the browser (Web Audio), not songs and not music files: slow soft synth chords, a gentle low hum, and an occasional quiet chime. It never repeats exactly, works offline, adds almost nothing to the download, and has no licensing questions (important for itch.io).
- It follows the game: very calm while planning, a little more movement while rovers drive, low wind underneath during a dust storm, sparser and colder on the Moon, and a short happy chime blended in on a find.
- A separate Music switch next to Sound, with a volume slider. It starts quiet and is remembered per device. It fades in after the first tap (browsers need a tap before playing sound).

**Batch 4 addition: clear missions modeled on real NASA campaigns** (playtest feedback from the 15-year-old: objectives need to be clear and say what they are about). Built together with the 12 minerals, since most objectives are about finding them.
- Each map is split into **campaigns**, the way NASA's science team really plans. Perseverance's real ones: Crater Floor, Delta Front, Upper Fan, Margin, Crater Rim. Spirit's: Columbia Hills and Home Plate. Apollo 15's: Hadley Rille and the Apennine Front.
- Each campaign has 2–4 **science objectives**, written like the team's real goals: "Find rocks that formed in water", "Collect a sample that could hold signs of ancient life", "Measure how dusty the air is before the storm season". Each one shows:
  - **What to do:** the concrete task ("Analyze 2 clay sites on the delta front, then drill the best one").
  - **Why scientists want it:** one or two sentences of real science, linked to the mineral tablet.
  - **Success criteria:** clear checkboxes, like NASA's "mission success" requirements, plus an optional bonus.
  - **Where to look:** a hint area on the map, as now.
- A **mission briefing** card at the start of each campaign, with a "Campaign complete" debrief card at the end that names the real mission it is based on (with the year).
- The mission panel always shows the current objective at the top, with its progress, so a player never has to guess what to do next.
- Text by role: Cadets get picture objectives ("Find 3 green gems"); Explorers get short sentences; Specialists get the full science reason and the instrument names.
- This is also the base for the 30-day Mission Log idea: a campaign is about one day of play.

**Batch 5 (planned): the 30-day Mission Log, for families and homeschool.** Goal: one hour a day for 30 days. Built on the batch 4 campaigns.
- Four weeks plus a finale, following real NASA history and one coding idea per week:
  - Week 1, Jezero: driving, scanning, minerals, what water leaves behind. Sequences.
  - Week 2, Gusev (Spirit): power, dust, weather, hot springs. Loops.
  - Week 3, Moon (Apollo 15): building a base, the Lab, materials. Conditions (if, while).
  - Week 4, Meridiani and Gale (new maps): signs of a living Mars and the 12 minerals. Multi-sol programs and functions.
  - Day 30, Jezero: Mars Sample Return, using everything.
- Each day is about an hour: a 5-minute briefing with a real story ("Today in 2004, Spirit…"), a 40-minute mission (main objective, bonus, challenge), and a 10-minute debrief (3 quiz questions, a new mineral tablet, a journal entry).
- Variety from day to day: rescue a stuck rover, race a dust storm, map a crater, photo survey, build the base, a power-limited day, coding puzzles with fixed rules, team relays. Each mission scales by role, from Cadet pictures to Python.
- A calendar with stars per day; missing a day never breaks anything. A weekly patch and a printable certificate at the end.
- A simple parent page: each child's days, stars and what they learned that day. Optional "time for a break" reminder after an hour. Offline, no accounts.
- Missions are short data entries (map, objectives, rules, briefing, quiz), so parents can change them or write their own later.
- Not now: a classroom teacher dashboard for 20–30 students (maybe later).

## Next revision (v3): real NASA maps

Replace the generated terrain with real data so the game shows the actual ground:
- **Imagery:** HiRISE and CTX orbital mosaics of each landing site (public domain, from NASA/JPL/University of Arizona and USGS).
- **Elevation:** HiRISE digital terrain models (DTMs) for real slopes. Slope decides what is drivable, like the real rover planners do.
- **Pipeline:** download, crop and downsample each site offline into a tile image plus a small height and terrain grid shipped with the game. Real features (Séítah, Home Plate, Mount Sharp) then sit where they really are.
- Keep the gameplay grid; derive terrain types (sand, bedrock, steep) from the real imagery and slope.

## Rule: science and story stay separate

Everything in the main game is real science: cards, facts, maps and rover history. Anything imaginary goes in a clearly labeled story mode with its own look, its own cards and its own collection, and is never mixed into the science content.

## Future idea: Mars Legends (imaginary story mode, top ranks)

- A deep-ground scanner unlocked at the top ranks (Principal Investigator or Mars Legend), after the RIMFAX deep radar.
- Reveals imaginary structures buried under sand (old power stations, living quarters, landing pads, tunnels) as faint outlines. The Excavator digs them out in stages, and the Lab studies the pieces.
- Its own "Mars Legends" card set, patches and museum shelf, always marked as science fiction.
- A real-science counterpart next to it: fossil traces of ancient microbes, which is what Perseverance is actually looking for.

Later updates: survival, Meridiani / Gale / North Polar / Moon maps, Epic and Ultimate perks, map editor, installable app.

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

**Batch 3:** team chain (find → drill → lab), Mars Catalog and base upgrades; satellite relay kit (multi-sol programs, blocks for Explorers and Python for Specialists, with mission recipes); gentle weather and forecasts; rover health dashboard (battery, tubes, wheels, dusty panels, temperature, signal, instruments; a simple face for Cadets; the station repairs everything for free); Moon map with the Apollo Lunar Roving Vehicle.

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

Later updates: survival, Meridiani / Gale / North Polar / Moon maps, Epic and Ultimate perks, Engineer coding perks (`sense_ahead()`, `if`, `while`, `def`), map editor, installable app.

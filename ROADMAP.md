# Crater Crew roadmap

Order agreed with the user. Real missions only; future missions are labeled "as NASA plans it".

**Current focus (user's decision): quality over size.** No new maps or worlds for now. Polish the six maps and
their campaigns that already exist, based on play-testing. Venera and Europa wait.

## Polish: Rover Garage and supply crates
**Status:** approved and live for everyone (game version 6), together with the Cadet back button and the helicopter camera.
- Perks become parts in slots: wheels, cameras, power, radio, science tool (Cadets: cameras, science tool, radio,
  computer). One part per slot; a better part of the same kind is fitted by itself.
- Supply crates: one per rank-up (parts in a set order, the same pace as the old rank perks) and one for the first
  finished expedition on each map (a random missing part). With every part owned, a crate holds XP and a sticker.
- The crate opens with an animation and shows the part, what it does in the game and what it does in real life.
- Garage button in the top bar (home and game) and on the map's dashboard (the parts strip with signal bars).
- Parts are drawn on every rover (bigger dish, radio mast, extra cameras, laser, battery, wiper, scoop, chip) and
  labeled in the garage picture. Changes are fitted from the next sol (sent with the plan in team games).
- Players keep everything they had: their rank perks become owned parts.
- Transmission picture on every Send: Earth's Deep Space Network dish sends dots to Mars. Stock antenna: few slow
  dots. Better radio: through an orbiter. High-gain dish: many fast gold dots straight to the rover's gold dish.
  It also names the next comms upgrade to look forward to.
- Station modules (team, this expedition only): each finished campaign builds the next one (radio tower, solar
  farm, storm garage, greenhouse); a Lab player can build them sooner. Station strip on the dashboard.
- How it adds up: signal = radio × dish × radio tower; night charge = role + solar farm; storm dust = wiper × garage,
  and a rover parked within 2 squares of the station during a storm gets no dust and a full charge.
- A new part fitted mid-expedition sparkles on the rover with a note.
- Garage pictures: the user's Explorer rover picture and NASA photos of Sojourner, Ingenuity and Apollo 15's rover
  (credits on the picture and in `game/img/garage/CREDITS.md`); Zhurong is drawn. Fitted parts glow with labels,
  empty slots show "?", and some parts change the picture (gold dish, laser, wheel rims).
- Later ideas: more parts per slot (higher levels), paint colors and flags as cosmetic crate prizes.

## Batch 7: Utopia Planitia, Mars (China's Zhurong rover, 2021)
**Status:** approved and live for everyone (game version 5, so older devices can't join a Utopia game).
- A new Mars map in the same style as the others. It unlocks after Gale.
- Four campaigns from the real mission:
  1. Landing and the lander "selfie": Zhurong dropped a small camera to photograph itself next to its lander.
  2. Driving south toward an ancient shoreline.
  3. Ground-penetrating radar for buried layers and possible ice.
  4. The dune field, and the winter hibernation of 2022.
- Zhurong gets an "About this rover" page: its solar "butterfly" panels, its radar and its cameras.

## Batch 8: Venera, Venus (Soviet landers, 1970s–1980s)
A race against time. Tribute to the courage of sending landers into 460 °C heat and about 90 times Earth's air
pressure. The real landers survived roughly one to two hours.
- **Choose your landing spot** on the Venus map, from orbit: plains, highlands, volcano slopes. Different spots
  have different discoveries.
- **Telemetry streams in** from the probe while it works: temperature, pressure, pictures, rock chemistry. The
  temperature inside the lander climbs every minute, and when it gets too hot, the probe goes silent.
- **Score:** who gets the best telemetry and the most discoveries at their landing spot before the probe dies.
  Every player in a team game sends their own lander, so it's a friendly race to the best data.
- Real touches: Venera 9 sent back the first pictures from another planet's surface (1975), Venera 13 the first
  color pictures and sound (1982), and the landers carried camera lens caps, a drill, and an X-ray instrument for
  rock chemistry.
- Teaches: the greenhouse effect, pressure, heat, and why Venus is hotter than Mercury.
- Could also become a one-hour challenge day in the Mission Log.
- **Status:** on hold. The drawn descent test (`tools/venera-test.html`, not linked from the game) was too
  cartoonish; the user will get a realistic descent video made, and the batch restarts from that.
- **First step:** a 20–30 second test of the descent for approval: entry glow (about 11 km/s), the parachute in
  pale yellow sulfuric-acid clouds (65–48 km), free fall on the braking ring under the clouds, the darker orange
  haze, touchdown, lens caps off, the fish-eye picture arriving line by line. Live telemetry for altitude, speed,
  temperature and pressure, plus wind and rumble sounds.
- **Soviet look:** the lander carries "СССР" and its mission name in Cyrillic ("ВЕНЕРА-13") in the style of the
  real probes. Important on-screen text is in Russian first, with English under it, for example:
  ВЫСОТА / Altitude, СКОРОСТЬ / Speed, ТЕМПЕРАТУРА / Temperature, ДАВЛЕНИЕ / Pressure, ПОСАДКА / Touchdown,
  ПЕРЕДАЧА ДАННЫХ / Data transmission, СВЯЗЬ ПОТЕРЯНА / Signal lost, ЦУП (mission control) for the control room.
  Russian is checked carefully (Cyrillic spelling, real terms), and the briefings tell the history in English.
- Picked extras: the timed parachute and wind drift, two clocks (heat and the carrier spacecraft's radio window),
  choosing what to transmit first, pre-launch upgrades (chilling, cooling block, insulation, camera, radio),
  the landing-spot trade-off (hot smooth plains, cooler rocky highlands, risky volcano slopes), the camera with lens
  caps, the drill and X-ray chemistry, the microphone, the lightning detector, the Venera 14 lens-cap story, history
  campaigns (Venera 7, 9, 13 and the Vega balloons), a mission report ranking with a team total, panorama
  postcards and "firsts" badges.

## Batch 9: Europa (NASA's Europa Clipper)
Plan already agreed: each sol is one flyby from orbit, with a ground track and instruments switched on along it.
A radiation meter replaces the battery, and each player runs one instrument team. Three campaigns: map the ice,
how thick is the ice, is there a plume. Halite (table salt) appears here. Defaults: it unlocks after the Mars maps,
there's no lander, and there's no Mission Log week yet. Clipper starts its Europa flybys in 2031.

## Next in line after the polish: James Webb Space Telescope
The user's idea, contemporary and different from driving. Kids point the telescope at chosen spots in the sky and
take pictures of what Webb really photographed, using Webb's real images (NASA/ESA/CSA/STScI, credited). Each
picture teaches one thing: galaxies, clouds of dust and gas, star formation, black holes, quasars, and so on.
**Status:** a level of Crater Crew, after the Moon (game/webb.html, opened from the level list like a map; back returns
  to the level list). Behind ?preview=webb until approved; MR.WEBB_ON = true in js/edition.js lists it for everyone and ships
  it in the builds (not in the free demo, which shows it as full game). Progress is per player profile (p.webb), so it
  travels with the save codes. Solo for now; team play later. The old webb-test.html link redirects.
- Three observing weeks with real dates (June 2022 First Light, August 2022, March 2023); the Sun rule (85-135
  degrees) decides what can be seen, and blocked targets say when they come back into view.
- Thirteen real targets with real Webb pictures and kid-level facts: Cosmic Cliffs, Southern Ring (NIRCam and MIRI),
  First Deep Field, Stephan's Quintet (black hole), WASP-96 b (water, needs NIRISS), Cartwheel, Pillars of
  Creation, Phantom Galaxy, Crab Nebula, Rho Ophiuchi, Sagittarius C (heart of the Milky Way), Messier 106
  (hungry black hole), the Jewelled Ring quasar. A fourth week: Black Hole Week (January 2024).
- Steering shows the next step (follow the arrow, let go, zoom in) until the Take the picture button appears.
- Webb turns freely, 360 degrees around the Sun and over the sky's poles; at the Sun limit it slides along the edge.
  The gold arrow (and planned slews) go around the Sun when the straight way is blocked. A big Sun gauge (top left)
  shows the Sun angle (keep it 85-135) and the angle around the Sun (0-360). Week goals (First Light: the 5 pictures of July 12, 2022).
- Three ways to fly: steer by hand (fine steering centers the target, then Take the picture), plan with
  observation cards (like NASA's APT forms), or write JavaScript (like Webb's onboard scripts; runs in a worker).
- Webb's rules in js/webb/model.js: slews with reaction wheels, guide star lock, momentum from sunlight on the
  sunshield (thrusters unload it), dithers, a 65 GB recorder, Deep Space Network downlink at 28 Mbit/s, 168 hours
  a week, event-driven skips. A systems panel shows it all; "How Webb works" explains each part.
- Results with stars (guide star, exposure, instrument, dithers) and an album.
- Dr. Orbit (js/webb/doc.js): an original, code-drawn funny scientist on a little LIVE screen. A soft chime says a
  message is coming, then the text types with pleasant blips while his mouth moves (no voice; sound can be turned off): hello and target clues, Sun-limit warnings, "take the
  picture", and reactions with facts or tips on the results.
- Webb Academy (campaign with Dr. Orbit, a one-man science team who needs his cadet's help): 1 Training day
  (guided: he names targets and explains each step), 2 Mystery targets (clues only, gold ? marks in the sky, wrong
  guesses get explained, 3 hints: second clue, gauge mark, arrow). Sessions 3-5 (plan a week, you're in charge with
  breaking news, graduation) are next. Ranks with hexagon badges: Cadet, Junior Space Surveyor, Star Detective,
  Mission Planner, Deep Space Duty Officer, Principal Investigator, Chief Scientist (graduate + every picture).
- Future mission idea: the Moon's leftover hardware with NASA's Lunar Reconnaissance Orbiter (Webb can't: the Moon is
  always too close to the Sun from L2, and Webb's sharpest detail there is about half a kilometer).
- Planned next (agreed): science requests with hidden targets (clues and gauge numbers, the arrow as a hint),
  spot-the-discovery inside each real picture, collection badges by kind on a sky map; then breaking-news targets
  (DART impact, Jupiter, Neptune) and team roles.
- Next: feedback from play, then fold it into the game (a Webb button on the menu, profiles, team play).

## Later ideas (keep in mind)
- **Titan:** NASA's Dragonfly drone, planned to land in 2034. Fly between landing spots, with methane lakes and dunes.
- **The Moon's far side and south pole:** China's Yutu-2 rover (since 2019), with a relay satellite needed to talk
  to Earth, and water ice in craters that are always dark.
- **Asteroid Ryugu:** Japan's Hayabusa2 hopping MINERVA rovers. Very low gravity, so you hop instead of roll.
- **Hard mode replays** and a **daily challenge**, for more play on finished maps.

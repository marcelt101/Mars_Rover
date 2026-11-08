# Crater Crew roadmap

Order agreed with the user. Real missions only; future missions are labeled "as NASA plans it".

**Current focus (user's decision): quality over size.** No new maps or worlds for now. Polish the six maps and
their campaigns that already exist, based on play-testing. Venera and Europa wait.

## Polish: Rover Garage and supply crates
**Status:** built behind `?preview=garage`, waiting for approval (together with `cadetback` and `helicam`).
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
- Going live: remove the `MR.GARAGE` preview check in `data.js` and raise `MR.VERSION` (team games send parts).
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

## Later ideas (keep in mind)
- **Titan:** NASA's Dragonfly drone, planned to land in 2034. Fly between landing spots, with methane lakes and dunes.
- **The Moon's far side and south pole:** China's Yutu-2 rover (since 2019), with a relay satellite needed to talk
  to Earth, and water ice in craters that are always dark.
- **Asteroid Ryugu:** Japan's Hayabusa2 hopping MINERVA rovers. Very low gravity, so you hop instead of roll.
- **Hard mode replays** and a **daily challenge**, for more play on finished maps.

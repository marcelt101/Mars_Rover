# Mars Rover

A browser game where you plan commands, send them to Mars, and watch a rover carry them out. It's set in Jezero Crater, where NASA's Perseverance rover explores.

**Play now: https://marcelt101.github.io/Mars_Rover/**

No install needed: open `game/index.html` in any browser (Chrome, Edge, Firefox, Safari).

## Games

| Folder | What it is |
|---|---|
| `game/` | **Jezero Expedition**: a big scrolling map of Jezero Crater with three crew roles |
| `classic/` | **Mars Rover Ops**: the original five small grid missions |

## Crew roles in Jezero Expedition

- **Cadet (ages 4–7):** big buttons, the rover moves right away. Find 5 sparkly treasures. Keyboard: arrow keys and space bar.
- **Explorer (ages 8–12):** build a plan of up to 12 blocks per sol (Mars day) and send it to Mars. Scan for signals, analyze them, drill the good ones and bring samples back to the base station.
- **Specialist (ages 13+):** write the plan in Python, with `for` loops and up to 40 actions per sol. Dust limits your view, sample tubes are scarcer and solar power is weaker.

### Python commands

```python
from mars import rover

rover.forward(3)    # drive 3 squares
rover.backward(1)
rover.turn_left()
rover.turn_right()
rover.scan()        # reveal signals and sand traps within 4 squares
rover.analyze()     # identify what is under the rover
rover.drill()       # collect a sample into a tube
rover.charge()      # +15% battery

for i in range(3):
    rover.forward(2)
```

## Real science in the game

- The map layout follows the real Jezero Crater: the river delta and Neretva Vallis channel to the west, the Séítah dunes to the southwest, and the Máaz plains around the landing area. Terrain is generated from that layout, not from exact elevation data (yet).
- Finds are based on real discoveries: clay and carbonates in the delta, olivine in Séítah, organic molecules, water-bearing salts and iron meteorites.
- Getting stuck in soft sand is what happened to the Spirit rover in 2009.

## Play online (GitHub Pages)

1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, and save.
3. After a minute the game is at `https://marcelt101.github.io/Mars_Rover/` (GitHub shows the exact link at the top of the Pages settings).

## Roadmap

1. ~~Big scrolling Jezero map, scan / analyze / drill, three crew roles~~ ✔
2. Power and survival: dust on the solar panels, cold nights, dust storms, the base station
3. Campaign missions based on real rover history, and saved progress
4. Repeat blocks, sensor checks (`if hazard_ahead():`) and functions
5. Map editor, more real maps (Gale, Meridiani, Gusev), and the link to a real ESP32 rover

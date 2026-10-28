# Mars Rover Ops

A co-op browser game where you plan rover commands, send them to Mars, and watch the rovers carry them out. Up to 6 players, each on their own device. Set in real places on Mars: Jezero Crater (Perseverance) and Gusev Crater (Spirit).

**Play now: https://marcelt101.github.io/Mars_Rover/**

No install needed. Works in Chrome, Edge, Firefox and Safari on PCs, Chromebooks, tablets and phones.

## Versions

| Link | What it is |
|---|---|
| [`/game/`](https://marcelt101.github.io/Mars_Rover/game/) | **Version 2**: team play, profiles, collecting, perks, two maps |
| [`/v1/`](https://marcelt101.github.io/Mars_Rover/v1/) | **Version 1**: single-player Jezero Expedition, kept as it was (also on the `v1` branch) |
| [`/classic/`](https://marcelt101.github.io/Mars_Rover/classic/) | The original five small grid missions |

## Playing together

1. Everyone opens the game on their own device and picks (or creates) their profile.
2. One person taps **Host**. A laptop or PC is the best host; keep its screen on.
3. Everyone else taps **Join** and types the room code (like `MARS-K7QF`), or scans the QR code with the camera.
4. Each player picks their rover in the lobby. The host picks the map and taps **Start expedition**.
5. Each sol (Mars day), everyone plans at the same time and presses **Ready**. When the whole team is ready, all rovers move at once.

The devices find each other through the free PeerJS service, then talk directly. A team game needs the internet to connect; solo play works offline. If a tablet drops out, it reconnects by itself and gets its rover back. If someone is taking too long, the host can tap **Start without waiting**.

## Crew roles

| Role | Ages | How you plan |
|---|---|---|
| **Cadet** | 4–7 | Picture buttons only. Each arrow is one square. Tap GO. No reading needed. |
| **Explorer** | 8–12 | Blocks with numbers: drive, turn, scan, analyze, drill, charge. |
| **Specialist** | 13+ | Python with `for` loops, up to 40 moves per sol. |

## Rovers

| Rover | For | Special |
|---|---|---|
| Buggy | Cadet | Digs up treasure, never gets stuck |
| Helicopter | Cadet | Flies over everything and spots treasure for the team (like Ingenuity) |
| Scout | Explorer, Specialist | Sees farther, scans 6 squares wide |
| Science | Explorer, Specialist | Analyze identifies every signal within 2 squares |
| Hauler | Explorer, Specialist | 4 extra sample tubes |
| Excavator | Explorer, Specialist | `dig()` clears a rock or sand trap in front, never gets stuck |

## Collecting and progress

- **Inventory:** press **I** (or **E**) any time, like Minecraft and Minetest.
- **Mineral cards** with real facts, rarities and rare shiny versions. Team finds go to everyone.
- **Mars history:** find Perseverance's backshell, the Ingenuity helicopter, and the Spirit rover where it got stuck.
- **24 mission patches**, **ranks** from Trainee to Flight Director, and **perks** (Wide wheels, Sharp eyes, SuperCam laser, Big battery).
- Finishing Jezero unlocks Gusev for the team.
- Progress is saved in each device's browser. **Parents and saves** on the start screen has a backup code to move or restore profiles, and a switch to unlock all maps.

## Keys

| Key | Does |
|---|---|
| I or E | Inventory |
| Esc | Close windows |
| T | Talk to the team |
| Tab | Look at the next rover |
| W A S D | Move the camera |
| F | Follow your rover |
| + / − | Zoom |
| 1–9 | Add commands (Explorer) |
| Arrow keys, Space | Add arrows and dig (Cadet) |
| Backspace | Remove the last step |
| Enter | Send or Ready (Ctrl+Enter in the Python editor) |

## Python commands (Specialist)

```python
from mars import rover

rover.forward(3)    # drive 3 squares
rover.backward(1)
rover.turn_left()
rover.turn_right()
rover.scan()        # reveal signals and sand traps nearby
rover.analyze()     # identify what is under the rover
rover.drill()       # collect a sample into a tube
rover.dig()         # Excavator only: clear a rock or sand trap in front
rover.charge()      # +15% battery

for i in range(3):
    rover.forward(2)
```

## For developers

Plain HTML, CSS and JavaScript. No build step.

- `game/js/data.js`: roles, rovers, commands, cards, patches, perks, ranks, maps
- `game/js/world.js`: map generation and the terrain picture
- `game/js/sim.js`: the rules. The host runs every rover's plan at the same time and records a timeline
- `game/js/net.js`: host-as-server networking (PeerJS / WebRTC)
- `game/js/profile.js`: profiles, rewards, saves
- `game/js/render.js`: the map, rovers and effects
- `game/js/ui.js`, `game/js/game.js`: screens and the game controller
- `game/vendor/`: PeerJS and qrcode-generator (MIT, see `LICENSES.txt`)

Testing options in the URL:
- `?net=local` connects several windows of one browser without PeerJS.
- `?slot=a` gives a window its own saves.
- `?peerhost=192.168.1.20&peerport=9000` uses your own PeerJS server instead of the public one.

The full plan is in [DESIGN.md](DESIGN.md).

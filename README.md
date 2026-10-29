# Mars Rover Ops

A co-op browser game where you plan rover commands, send them to Mars, and watch the rovers carry them out. Up to 6 players, each on their own device. Set in real places: Jezero Crater (Perseverance), Gusev Crater (Spirit), Meridiani Planum (Opportunity) and Gale Crater (Curiosity) on Mars, and Hadley Rille on the Moon (Apollo 15).

**Play now: https://marcelt101.github.io/Mars_Rover/**

No install needed. Works in Chrome, Edge, Firefox and Safari on PCs, Chromebooks, tablets and phones.

## Versions

| Link | What it is |
|---|---|
| [`/game/`](https://marcelt101.github.io/Mars_Rover/game/) | **Version 2**: team play, profiles, collecting, perks, five maps, the 30-day Mission Log |
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
| **Explorer** | 8–12 | Blocks with numbers: drive, turn, scan, analyze, drill, charge. The Repeat block holds other blocks, and more smart blocks come with the relay kit. |
| **Specialist** | 13+ | Python with `for`, `while`, `if`/`elif`/`else`, `def` and rover sensors. Up to 40 moves per sol. |

## Rovers

| Rover | For | Special |
|---|---|---|
| Buggy | Cadet | Digs up treasure, never gets stuck |
| Helicopter | Cadet | Flies over everything and spots treasure for the team (like Ingenuity) |
| Scout | Explorer, Specialist | Sees farther, scans 6 squares wide |
| Science | Explorer, Specialist | Analyze identifies every signal within 2 squares |
| Hauler | Explorer, Specialist | 4 extra sample tubes |
| Excavator | Explorer, Specialist | `dig()` clears a rock or sand trap in front, never gets stuck |
| Lab | Explorer, Specialist (team games) | Stays at the station. Catalogs the team's samples and builds base upgrades |

Scouts and Haulers look like Spirit and Opportunity (big winged solar array, Pancam mast, round dish antenna). Science and Excavator rovers look like Perseverance. The Cadet's Buggy looks like Sojourner, the first rover on Mars. On the Moon the ground rovers are Apollo Lunar Roving Vehicles, the station is the Lunar Module, and the helicopter stays home (there is no air to fly in).

**About this rover:** tap the **i** on any rover in the lobby (or open Inventory → Rover → About the rovers, or the Health window) to learn, at kid level, which real rover it is based on, how it works, its main parts and its science tools (Mastcam-Z, SuperCam, PIXL, SHERLOC, APXS, the RAT and more). Perseverance has NASA's labeled instrument picture. On Gale Crater, the Science and Excavator rovers open Curiosity, with the body-part guide from NASA's "Mars Engineering: Curiosity" sheet (eyes, neck, ears and voice, hand, legs, tail). Where the game adds something the real rover doesn't have, the text says so.

## Getting started

**What the game teaches** (on the start screen, first in the tutorial bar and the links) is a page for teachers and parents. It describes the game world and, subject by subject, what children learn and where they meet it: engineering, programming, rocks and minerals, chemistry, weather, space science, astrobiology, history of space exploration, math, the scientific method and teamwork. It also has a typical one-hour Mission Log day and tips for adults.

New players can take the optional **tutorial** from the start screen. It has different steps for Cadet, Explorer and Specialist, points at the real buttons, and reads the steps aloud for Cadets. It also walks through the mission bar, plan cards, Health, Mission Control, Inventory, photos and the Mission Log. The tutorial bubble can be dragged anywhere with a finger or the mouse (handy on phones); double-tap it to snap it back. While playing, each objective shows a hint with a **Show** button, arrows at the map edge point to where to look, and helpers like **Plan route home** build the plan for you.

## Planning helpers

- **Tap the map** to plan: *Drive here*, *Drive here and scan*, *Go and check it* on a signal, or *Go home* on the station. The blocks are built for you, and you can still edit them.
- **Team markers:** tap the map to drop ⛏ Dig here, ⚠ Danger or ★ Meet here. Everyone sees them.
- **Flags and Finds:** every signal a rover finds gets a flag in the finder's color and a site name (like NASA's "Rochette" or "Cheyava Falls"). The **Finds** list shows the best ones first. Claim one with *I'll drill this*, or tap *Go*. The finder gets credit when a teammate drills it, and can rename the site.
- **Battery estimate** under the plan, with a warning if there won't be enough to get home.
- **Undo** (or Ctrl+Z).
- **Plan cards:** each step shows a picture, a plain sentence, which way the rover will face and how much battery is left. Steps that would hit a known rock or sand trap, or run out of battery, are marked before you send. Drag a card by its ⋮⋮ handle to move it.
- **Sol report** after every sol, with **plan stars** (worked, efficient, smart) and a tip for writing better plans and code.

## Team chain: find → drill → lab

The Scout finds and flags a site, a teammate drills it, and the Lab catalogs the sample when it reaches the station. The **Mars Catalog** lists every sample with everyone who helped. The Lab turns samples into materials and builds base upgrades that help the whole team:

| Upgrade | Costs | Does |
|---|---|---|
| Radio tower | 3 metal | Signals reach the rovers 25% faster |
| Solar farm | 2 glass, 2 metal | Every rover charges 10% more each night |
| Garage | 3 bricks, 1 metal | Wheels and solar panels wear half as fast |
| Greenhouse | 3 water, 2 bricks | Everyone earns 10% more XP |

Without a Lab player, samples are cataloged automatically.

## 30-day Mission Log

About one hour a day for 30 days, made for families and homeschool. Open it from the start screen (or press **L**).

| Week | Place | Coding idea |
|---|---|---|
| 1 | Jezero (Perseverance) | Sequences |
| 2 | Gusev (Spirit) | Loops |
| 3 | The Moon (Apollo 15) | Conditions (if, while) |
| 4 | Meridiani (Opportunity) and Gale (Curiosity) | Programs that run for days, functions |
| Day 30 | Jezero | Mars Sample Return |

Each day has a real story, a coding idea, a mission (a real campaign or a special day like *Dust Storm*, *Free Spirit* or *Hammer and Feather*), then a 3-question quiz and a journal page that goes into the science notebook. Days earn up to 3 stars. Missing a day never breaks anything. Weekly patches and a printable certificate at the end. Team games work too: every player's own Mission Log records the day.

**Parents and saves** shows each child's days, stars, quiz score, minutes played today and in total, and what they learned. It also has a break reminder (default: after 60 minutes).

## Mission Control

Press **O** (or ☷ next to the map) for a kid-sized version of NASA's Open MCT mission control software:
- every rover's status in one table, with colored alarms (battery, wheels, dust, tubes) and gray "No signal" for players who dropped out
- charts of battery, dust, wheels and distance per sol
- the sol timeline: what each rover plans to do this sol
- your own alarm rules ("if battery < 40 then yellow")
- a Mars clock, and replays of the last few sols

## Science notebook and photos

Finds, campaigns, photos and Mission Log journal pages go into your **Notebook** automatically (inventory, **I**); add your own notes too. Add **Photo** (**P**, or `rover.photo()`) to a plan to take a Navcam picture; the newest 40 are kept in the **Photos** album.

## Campaigns and objectives

Each map is split into the campaigns NASA's teams really ran:

| Map | Campaigns |
|---|---|
| Jezero | Crater Floor, Delta Front, Margin and Neretva Vallis (Perseverance, 2021–2024) |
| Gusev | Gusev Plains, Columbia Hills, Home Plate (Spirit, 2004–2009) |
| Moon | Hadley Rille, Apennine Front, Back to Falcon (Apollo 15, 1971) |
| Meridiani | Eagle Crater, Endurance and Victoria, Endeavour Crater (Opportunity, 2004–2018) |
| Gale | Yellowknife Bay, the Kimberley and Pahrump Hills, Vera Rubin Ridge and the sulfate unit (Curiosity, 2012–today) |

A **briefing** opens at the start of each campaign: the real story, then each objective with what to do, why scientists want it and when it is done. The **mission bar** at the top of the side panel always shows the objective to work on now. Tap **Why?** next to an objective to read the science, and **Show** to see where to look. When a needed mineral has been spotted, a helper offers to plan the route there. Finishing a campaign shows a debrief and the next briefing; finishing the last one completes the map.

## Minerals chart

Press **I** and open **Minerals chart**. It is laid out like the periodic table, with one row per mineral family (silicates, carbonates, sulfates, chlorides, oxides, phosphates, organics, metals, rocks). Every mineral has an **information tablet**: what it is made of, where a rover really found it, the instrument that detects it, and why scientists care. ❋ marks the 12 signs of a living Mars. Under the chart, an **element strip** lights up as you find minerals containing each element. One mineral (halite) comes with a future map.

## Satellite relay kit

Unlocks at the second rank (Rover Driver). Programs can then keep running for more than one sol, with help from the relay satellite, which also maps the area around the rover when a long program starts.

- **Explorers** always have *Repeat*. The kit adds *If on a signal*, *If worth drilling*, *If path clear*, *Until full or low battery*, plus *Go to signal*, *Go home* and **Run for 2 sols**. Click a smart block to put new blocks inside it.
- **Specialists** get `rover.go_to_signal()`, `rover.go_home()` and `for sol in rover.mission(2):` (1 to 3 sols).
- **Recipes** give ready-made programs to start from (*Signal hunter*, *Survey square*, *Careful driver*, *Home run*).
- **AutoNav safety:** the rover finds a new route when *Go to signal* or *Go home* meets a rock, stops a program before it would hit something, and pauses at low battery to recharge overnight. A `while` loop stops after 30 rounds.
- While a program runs, press **Send** with an empty plan to let it continue, make a new plan to replace it, or tap **Cancel program**.

## Weather and rover health

- A **weather station** report each sol, with a forecast for the next 2 sols. Dust storms are rare and short: rovers see 1 square less and the solar panels charge half. The Moon has no weather.
- **Rover health (H):** round gauges for battery, solar panels, wheels, sample tubes, heaters and radio. Tap one to learn about it. Cadets see a simple face. Driving onto the station repairs everything for free.

## Collecting and progress

- **Inventory:** press **I** (or **E**) any time, like Minecraft and Minetest.
- **Mineral cards** with real facts, rarities and rare shiny versions. Team finds go to everyone.
- **Mars history:** find Perseverance's backshell, the Ingenuity helicopter, and the Spirit rover where it got stuck.
- **54 stickers**, **50 mission patches** (including coding ones like *Hello, Mars*, *Perfect Plan*, *Loop in a Loop*, *Smart Rover*, *Mission Control*, *Life Hunter* and *Element Explorer*), **10 ranks** from Trainee to Mars Legend, and **perks** (Wide wheels, Sharp eyes, Better radio, SuperCam laser, High-gain antenna, Big battery).
- **Music:** calm space music made live in the browser, with a Music switch and volume slider under the map. It changes for driving, dust storms and the Moon.
- **Signal delay:** each sol's commands take 5–10 seconds to reach Mars with the stock antenna. Better radio makes it 30% faster, the High-gain antenna twice as fast. Cadets get both automatically as they rank up.
- Finishing Jezero unlocks Gusev, then the Moon, Meridiani and Gale.
- **Expeditions are saved** after every sol on the device that runs the game (solo, or the host). Tap **Continue** on the start screen to pick up where you left off, even after closing the browser. In a team game the host gets a new room code, and everyone who joins again with the same profile gets their own rover back.
- Progress is saved in each device's browser. **Parents and saves** on the start screen has a backup code to move or restore profiles, and a switch to unlock all maps.

## Keys

| Key | Does |
|---|---|
| W or ↑ | Forward (press again to add a square) |
| A or ← / D or → | Turn left / right |
| S or ↓ | Back |
| Space | Drill (Dig for Cadets) |
| Q / R / G / C | Scan / Analyze / Dig (Excavator) / Charge |
| Q, 1–8 (Lab) | Catalog, make materials, build upgrades |
| H | Rover health |
| O | Mission Control |
| P | Photo |
| L | Mission Log (start screen) |
| Backspace | Remove the last step |
| Ctrl+Z | Undo |
| Enter | Send or Ready (Ctrl+Enter in the Python editor) |
| I or E | Inventory |
| M | Big map |
| Shift + W A S D | Move the camera |
| F | Follow your rover |
| Tab | Look at the next rover |
| T | Talk to the team |
| + / − or mouse wheel | Zoom (the wheel zooms toward the pointer) |
| Esc | Close windows |

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
rover.photo()       # take a Navcam picture

for i in range(3):
    rover.forward(2)

# sensors work in if / elif / else / while
if rover.sense_ahead() == "clear":   # "rock", "clear", "sand", "signal", "edge"
    rover.forward(1)
elif rover.battery() < 30:
    rover.charge()
else:
    rover.turn_right()
# also: signal_here(), signal_nearby(), worth_drilling(), tubes_full(), storm(), at_home()

def check():
    rover.analyze()
    if rover.worth_drilling():
        rover.drill()

# satellite relay kit (second rank)
for sol in rover.mission(2):          # runs on this sol and the next
    rover.scan()
    while not rover.tubes_full() and rover.battery() > 40:
        rover.go_to_signal()
        check()
    rover.go_home()

# Lab job
lab.catalog()
lab.make("metal")                    # "water", "metal", "bricks", "glass"
lab.build("radio_tower")             # "solar_farm", "radio_tower", "garage", "greenhouse"
```

## For developers

Plain HTML, CSS and JavaScript. No build step.

- `game/js/data.js`: roles, rovers, commands, cards, patches, perks, ranks, maps
- `game/js/minerals.js`: the minerals chart: families, elements and the information tablets
- `game/js/campaigns.js`: campaigns and their science objectives
- `game/js/music.js`: the generated background music
- `game/js/missionlog.js`: the 30 days: stories, missions, quizzes, journal prompts
- `game/js/log-ui.js`: the Mission Log screens, notebook, photos and parent page
- `game/js/ops.js`: Mission Control
- `game/js/world.js`: map generation and the terrain picture
- `game/js/sim.js`: the rules. The host runs every rover's plan at the same time and records a timeline. Also the Python parser and the program runner for the relay kit (programs live on the rover, so they carry across sols)
- `game/js/net.js`: host-as-server networking (PeerJS / WebRTC)
- `game/js/profile.js`: profiles, rewards, saves
- `game/js/render.js`: the map, rovers and effects
- `game/js/ui.js`, `game/js/game.js`: screens and the game controller
- `game/vendor/`: PeerJS and qrcode-generator (MIT, see `LICENSES.txt`)

`tools/playtest-bots.js` runs robot players (a Cadet, a beginner with and without hints, a good Explorer) on the real rules and prints pacing numbers: time to first reward, finish rate, boring sols, rank timing.

Testing options in the URL:
- `?net=local` connects several windows of one browser without PeerJS.
- `?slot=a` gives a window its own saves.
- `?uplink=0.1` shortens the signal delay for testing.
- `?brief=0` skips the campaign briefings (for automated tests).
- `?peerhost=192.168.1.20&peerport=9000` uses your own PeerJS server instead of the public one.

The full plan is in [DESIGN.md](DESIGN.md).

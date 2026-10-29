# Releasing Mars Rover Ops

There is one game, in `game/`, on the `main` branch. Every release (the web version on GitHub Pages, the itch.io
demo, the itch.io full game and, later, the desktop app) is built from it. There are no separate branches to keep
in sync.

## Editions

What each edition includes is set in one table, `MR.EDITIONS` in `game/js/edition.js`:

| Edition | Where | What it includes |
|---|---|---|
| `web` | GitHub Pages | Everything, plus links to version 1 and the classic missions |
| `itch-demo` | itch.io, free demo file | Jezero Crater and Mission Log week 1 (days 1 to 7), a "Get the full game" banner |
| `itch-full` | itch.io, paid file | Everything |
| `desktop` | later: Electron or Tauri app | Everything |

To limit a new feature to some editions, add a field to the table (for example `photos:true`) and check it in the
code with `MR.ED.photos`. Leave it out of the table and everyone gets it.

## Adding a feature

1. Build and test it on `main` as usual. Pushing to `main` updates the web version.
2. If it belongs only to some editions, add the field to the edition table.
3. Make the release files (next section).

## Making a release

```
python3 tools/build.py              # itch-demo and itch-full
python3 tools/build.py desktop      # any edition by name
```

The zip files land in `dist/` (not saved in git), named like `mars-rover-ops-itch-full-itch-1.0.zip`. Each has
`index.html` at the top, which is what itch.io expects. The build name comes from the git tag, so tag first:

```
git tag itch-1.0 && git push origin itch-1.0
python3 tools/build.py
```

The tag marks exactly what was uploaded. To fix a bug a buyer reports: fix it on `main`, tag `itch-1.1`, build
and upload again.

## itch.io page settings

- Kind of project: HTML. Upload `itch-full` as the paid file with "This file will be played in the browser", and
  `itch-demo` marked as the demo.
- Price: $5 at launch (from the pricing notes), with the demo free.
- Embed: about 1280 × 800, with "Fullscreen button" and "Mobile friendly" on.
- When the page exists, put its address in `buyUrl` for `itch-demo` in `edition.js`, so the demo's
  "Get the full game" button links to it.

## Things to know on itch.io

- Saves use the browser's storage inside itch.io's game frame. They stay after a reload. Some browsers clear
  saved data for embedded pages after a while, so the Parents and saves page has a backup code to copy and
  restore.
- Team games work on itch.io: everyone opens the game page and joins with the room code. The QR code is hidden
  there, because it would point at itch.io's internal game address instead of the store page.

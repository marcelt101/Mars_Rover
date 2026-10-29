# Releasing Crater Crew

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

The zip files land in `dist/` (not saved in git), named like `crater-crew-itch-full-itch-1.0.zip`. Each has
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
- itch.io account: **MarsHorizon**, page `https://marshorizon.itch.io/crater-crew` (the demo's "Get the full game"
  button links there; change `buyUrl` in `edition.js` if the page address is different).
- Price (settled): free demo; full game at an introductory **$6.99**, going to **$9.99** after one or two months;
  **$29.99 suggested for schools** (itch.io's "let people pay more" option, honor system).
  Simplest on itch.io: set the price to $9.99 and run a sale (about 30% off) for the first weeks.
  Only the host needs the full game: demo players can join a full-game room and play every map in it.
- Embed: about 1280 × 800, with "Fullscreen button" and "Mobile friendly" on.
- When the page exists, put its address in `buyUrl` for `itch-demo` in `edition.js`, so the demo's
  "Get the full game" button links to it.

## Beta and bug reports

- `beta:true` in an edition shows a yellow BETA badge. It is off for release 1.0.
- Players report problems from Settings, the Parents page or the BETA badge, and the game offers a report when an
  error happens. Nothing is sent without a tap on Send, and reports carry no names and no chat.
- Reports go to a Google Form: set `MR.REPORT` in `edition.js` to the form's `formResponse` address and its three
  entry ids (`what`, `doing`, `details`). Without a form, players can copy the report and email it (`email`).

## Things to know on itch.io

- Saves use the browser's storage inside itch.io's game frame. They stay after a reload. Some browsers clear
  saved data for embedded pages after a while, so the Parents and saves page has a backup code to copy and
  restore.
- Team games work on itch.io: everyone opens the game page and joins with the room code. The QR code is hidden
  there, because it would point at itch.io's internal game address instead of the store page.

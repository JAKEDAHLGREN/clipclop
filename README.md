# ClipClop

A lightweight, privacy-first clipboard history manager for macOS that lives in your menu bar.

Clip everything while you work, then find it again — instantly. ClipClop quietly records what you copy, keeps your last 30 items, and lets you search, restore, or delete them from a ⌘⇧V hotkey or a click on the tray icon.

Everything stays on your machine. No cloud, no account, no telemetry.

---

## Features

- **Menu-bar app** — tiny tray icon, no Dock clutter; right-click it for **Launch at Login** and **Quit**
- **Automatic capture** — copies are detected within ~300 ms while running in the background
- **Last 30 items** — configurable in code; oldest items are automatically evicted
- **Re-copy aware** — copying the same text again, or picking it from the list, moves it to the top instead of duplicating it
- **Skips passwords** — copies that password managers mark as concealed or transient are never recorded
- **Search-as-you-type** — case-insensitive, filters your history as you type
- **Full keyboard workflow** — the first item is pre-selected; search, arrow keys, Enter to copy, Esc to clear or close — no mouse required
- **Restore to clipboard** — click (or Enter) any item; the list closes and focus returns to your app, ready for ⌘V
- **Delete & clear** — hover for an × to remove one item, or "Clear All" with confirmation
- **Persistent history** — survives restarts, stored as plain JSON
- **Global hotkey** — ⌘⇧V opens the manager right next to your mouse cursor, from any application
- **Dark, modern UI** — card-based list with live relative timestamps and error toasts

## Install

### Option 1 — DMG (recommended)

1. Build the DMG once with `npm run dist` (produces `dist/ClipClop-1.0.0-arm64.dmg`).
2. Open the DMG and drag **ClipClop.app** into your **Applications** folder.
3. On first launch, right-click the app and choose **Open** (it's ad-hoc signed, not App Store signed).
4. To start at login: right-click the tray icon → **Launch at Login**.

### Updating an installed copy

1. Right-click the tray icon → **Quit ClipClop** (also quit any `npm start` copy).
2. Pull the latest code and run `npm run dist`.
3. Open `dist/ClipClop-<version>-arm64.dmg` (double-click it in Finder, or `open dist/*.dmg`) and drag **ClipClop.app** into **Applications**, choosing **Replace**.
4. Eject the disk image, then open ClipClop from Applications (right-click → **Open** the first time).

Your history in `~/.clipclop/history.json` is kept across updates.

### Option 2 — Build from source

Requires [Node.js](https://nodejs.org) 22+ and a Mac with Xcode Command Line Tools.

```sh
git clone https://github.com/JAKEDAHLGREN/clipclop.git
cd clipclop
npm install
npm start
```

To produce the distributable DMG/ZIP:

```sh
npm run dist   # outputs dist/ClipClop-1.0.0-arm64.dmg + .zip
```

## Usage

| Action | How |
|---|---|
| Open the manager | Click the clipboard tray icon (opens below it), or press ⌘⇧V (opens beside the cursor) |
| Search history | Start typing — results filter live, top match is pre-selected |
| Copy an item back to clipboard | Click it, or press Enter on the highlighted item — it moves to the top and the list closes |
| Navigate the list | ↑ / ↓ arrow keys |
| Clear the search / close | Esc clears the search; Esc again (or ⌘⇧V) closes the list |
| Launch at login / quit | Right-click the tray icon |
| Delete one item | Hover the item and click **×** |
| Clear all history | Footer → **Clear All** (confirms first) |
| Paste after copying | Press ⌘V — focus is already back in the app you were using (no auto-paste yet) |

## Data & privacy

- History is stored locally at `~/.clipclop/history.json` (max 30 items).
- Writes are **atomic** (temp file + rename) and corruption-safe — if the file is ever damaged, it's backed up to `history.json.corrupt` and the app recovers without crashing.
- **Nothing ever leaves your Mac.** There are no network calls, no analytics, no login.
- Copies marked as concealed/transient by password managers (the [nspasteboard.org](http://nspasteboard.org) convention used by 1Password, Bitwarden and others) are skipped and never written to disk.
- Other clipboard contents may still include sensitive data (tokens, keys copied by hand). Treat `~/.clipclop/history.json` as sensitive.

## Development

```sh
npm start     # run the app in development
npm test      # run the unit test suite (node:test)
npm run lint  # syntax-check all source files
npm run pack  # build just the .app bundle (dist/mac-arm64/)
npm run dist  # build the DMG + ZIP release artifacts
```

Only one copy of ClipClop runs at a time, and the installed app and `npm start` count as the same app. Quit the installed copy (tray icon → **Quit ClipClop**) before running `npm start`, or the dev copy will exit immediately. **Launch at Login** is greyed out in the dev copy; it only works in the installed app.

The 15 unit tests cover the `ClipboardStore` core: add/dedupe/re-copy-to-top, promote-on-pick, the 30-item eviction limit, persistence round-trips, corrupt-file recovery, and delete/clear mutations.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm start` prints nothing and no icon appears | Another ClipClop is already running and took over. Quit it from its tray icon (or Activity Monitor), then run `npm start` again. |
| ⌘⇧V doesn't do "Paste and Match Style" in other apps anymore | ClipClop registers ⌘⇧V globally, which overrides that shortcut in apps like Google Docs, Slack and Notes. A configurable hotkey is on the roadmap. |
| The list doesn't open | Check the terminal (dev) for a "Failed to register global shortcut" warning — another app may already own ⌘⇧V. The tray icon still works. |

## Project structure

```
.
├── main.js               # Main process: clipboard poller, tray + menu, popover positioning, IPC, global hotkey
├── store.js              # ClipboardStore: pure, testable history/persistence logic
├── preload.js            # contextBridge IPC bridge (window.clipclop API)
├── src/
│   ├── index.html        # Popover UI markup
│   ├── styles.css        # Dark theme
│   └── renderer.js       # UI logic: search, keyboard nav, reset-on-open, toasts
├── assets/icon.png       # Tray icon
├── build/icon.icns       # App icon
├── test/store.test.js    # Unit tests (node:test)
└── after-pack.js         # Ad-hoc codesign hook for electron-builder
```

## Tech stack

- **Electron 33** — main/renderer/preload process model with `contextIsolation` on and `nodeIntegration` off
- **Plain HTML/CSS/JS** renderer — no framework, no build step for the UI
- **Node built-ins** (`node:test`, `crypto`, `fs`) — zero runtime dependencies beyond Electron
- **electron-builder** — packaging to DMG/ZIP with ad-hoc code signing

## Roadmap (v2 ideas)

- Image / rich-text / file clipboard support
- Pinned items and unlimited history
- Automatic paste into the previous app
- Configurable history limit and hotkey
- Snippets / favorites

## License

MIT
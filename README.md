# ClipClop

A lightweight, privacy-first clipboard history manager for macOS that lives in your menu bar.

Clip everything while you work, then find it again — instantly. ClipClop quietly records what you copy, keeps your last 30 items, and lets you search, restore, or delete them from a ⌘⇧V hotkey or a click on the tray icon.

Everything stays on your machine. No cloud, no account, no telemetry.

---

## Features

- **Menu-bar app** — tiny tray icon, no Dock clutter (launches at login if added to Login Items)
- **Automatic capture** — copies are detected within ~300 ms while running in the background
- **Last 30 items** — configurable in code; oldest items are automatically evicted
- **Re-copy aware** — copying the same text again moves it to the top instead of duplicating it
- **Search-as-you-type** — case-insensitive, filters your history as you type
- **Full keyboard workflow** — search, arrow-key navigation, Enter to copy, Esc to clear — no mouse required
- **Restore to clipboard** — click (or Enter) any item; paste it anywhere with ⌘V
- **Delete & clear** — hover for an × to remove one item, or "Clear All" with confirmation
- **Persistent history** — survives restarts, stored as plain JSON
- **Global hotkey** — ⌘⇧V opens the manager from any application
- **Dark, modern UI** — card-based list with relative timestamps and copy/error toast feedback

## Install

### Option 1 — DMG (recommended)

1. Build the DMG once with `npm run dist` (produces `dist/ClipClop-1.0.0-arm64.dmg`).
2. Open the DMG and drag **ClipClop.app** into your **Applications** folder.
3. On first launch, right-click the app and choose **Open** (it's ad-hoc signed, not App Store signed).
4. To start at login: System Settings → General → **Login Items** → add ClipClop.

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
| Open the manager | Click the clipboard tray icon, or press ⌘⇧V |
| Search history | Start typing — results filter live |
| Copy an item back to clipboard | Click it, or press Enter on the highlighted item |
| Navigate the list | ↑ / ↓ arrow keys |
| Clear the search | Esc |
| Delete one item | Hover the item and click **×** |
| Clear all history | Footer → **Clear All** (confirms first) |
| Paste after copying | Switch to your target app and press ⌘V (manual paste — no auto-paste in v1) |

## Data & privacy

- History is stored locally at `~/.clipclop/history.json` (max 30 items).
- Writes are **atomic** (temp file + rename) and corruption-safe — if the file is ever damaged, it's backed up to `history.json.corrupt` and the app recovers without crashing.
- **Nothing ever leaves your Mac.** There are no network calls, no analytics, no login.
- Clipboard contents may include sensitive data (passwords, tokens). Treat `~/.clipclop/history.json` as sensitive.

## Development

```sh
npm start     # run the app in development
npm test      # run the unit test suite (node:test)
npm run lint  # syntax-check all source files
npm run pack  # build just the .app bundle (dist/mac-arm64/)
npm run dist  # build the DMG + ZIP release artifacts
```

The 11 unit tests cover the `ClipboardStore` core: add/dedupe/re-copy-to-top, the 30-item eviction limit, persistence round-trips, corrupt-file recovery, and delete/clear mutations.

## Project structure

```
.
├── main.js               # Main process: clipboard poller, tray, popover, IPC, global hotkey
├── store.js              # ClipboardStore: pure, testable history/persistence logic
├── preload.js            # contextBridge IPC bridge (window.clipclop API)
├── src/
│   ├── index.html        # Popover UI markup
│   ├── styles.css        # Dark theme
│   └── renderer.js       # UI logic: search, keyboard nav, toasts
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
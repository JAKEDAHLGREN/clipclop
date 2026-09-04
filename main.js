const { app, BrowserWindow, Tray, clipboard, ipcMain, nativeImage, screen, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const HISTORY_DIR = path.join(app.getPath("home"), ".clipclop");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");
const MAX_CLIPS = 30;
const POLL_INTERVAL = 300;

let tray = null;
let popover = null;
let clips = [];
let lastClipboardText = "";
let pollTimer = null;

function ensureHistoryDir() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

function loadClips() {
  try {
    ensureHistoryDir();
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        clips = parsed.filter(
          (c) => c && typeof c.id === "string" && typeof c.content === "string"
        );
      } else {
        throw new Error("History data is not an array");
      }
    }
  } catch (err) {
    console.error("Failed to load clips:", err.message);
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        fs.copyFileSync(HISTORY_FILE, HISTORY_FILE + ".corrupt");
      }
    } catch (_) {}
    clips = [];
  }
}

function saveClips() {
  try {
    ensureHistoryDir();
    const tmp = HISTORY_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(clips, null, 2), "utf-8");
    fs.renameSync(tmp, HISTORY_FILE);
  } catch (err) {
    console.error("Failed to save clips:", err.message);
  }
}

function addClip(text) {
  clips = clips.filter((c) => c.content !== text);
  const clip = {
    id: crypto.randomUUID(),
    content: text,
    createdAt: new Date().toISOString(),
  };
  clips.unshift(clip);
  while (clips.length > MAX_CLIPS) {
    clips.pop();
  }
  saveClips();
  broadcastClips();
}

function broadcastClips() {
  if (popover && popover.webContents && !popover.isDestroyed()) {
    popover.webContents.send("clips-updated", clips);
  }
}

function startClipboardMonitor() {
  try {
    lastClipboardText = clipboard.readText();
  } catch (_) {
    lastClipboardText = "";
  }
  pollTimer = setInterval(() => {
    try {
      const current = clipboard.readText();
      if (current && current !== lastClipboardText) {
        lastClipboardText = current;
        addClip(current);
      }
    } catch (err) {
      console.error("Clipboard poll error:", err);
    }
  }, POLL_INTERVAL);
}

function stopClipboardMonitor() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function createPopover() {
  if (popover && !popover.isDestroyed()) {
    popover.show();
    popover.focus();
    return;
  }

  popover = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popover.loadFile(path.join(__dirname, "src", "index.html"));
  popover.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  popover.webContents.on("will-navigate", (e) => e.preventDefault());

  popover.on("blur", () => {
    if (popover && !popover.isDestroyed()) {
      if (popover.webContents.isDevToolsOpened()) {
        return;
      }
      popover.hide();
    }
  });

  positionPopoverBelowTray();
}

function positionPopoverBelowTray() {
  if (!tray || !popover) return;
  try {
    const trayBounds = tray.getBounds();
    const { width, height } = popover.getSize();
    const display = screen.getDisplayMatching(trayBounds);
    let x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2);
    let y = Math.round(trayBounds.y + trayBounds.height + 4);
    if (x + width > display.bounds.x + display.bounds.width) {
      x = display.bounds.x + display.bounds.width - width;
    }
    if (x < display.bounds.x) {
      x = display.bounds.x;
    }
    if (y + height > display.bounds.y + display.bounds.height) {
      y = trayBounds.y - height - 4;
    }
    popover.setPosition(x, y);
  } catch (err) {
    console.error("Failed to position popover:", err);
  }
}

function togglePopover() {
  if (!popover || popover.isDestroyed()) {
    createPopover();
    popover.once("ready-to-show", () => {
      positionPopoverBelowTray();
      popover.show();
      popover.focus();
      popover.webContents.send("clips-updated", clips);
    });
    return;
  }
  if (popover.isVisible()) {
    popover.hide();
  } else {
    positionPopoverBelowTray();
    popover.show();
    popover.focus();
    popover.webContents.send("clips-updated", clips);
  }
}

function hidePopover() {
  if (popover && !popover.isDestroyed() && popover.isVisible()) {
    popover.hide();
  }
}

function setupIpc() {
  ipcMain.handle("copy-to-clipboard", (_event, args) => {
    try {
      const id = args?.id;
      if (typeof id !== "string") return { success: false };
      const clip = clips.find((c) => c.id === id);
      if (!clip) {
        return { success: false };
      }
      clipboard.writeText(clip.content);
      lastClipboardText = clip.content;
      if (popover && !popover.isDestroyed()) {
        popover.webContents.send("clipboard-copied", { id });
      }
      return { success: true };
    } catch (err) {
      console.error("copy-to-clipboard error:", err);
      return { success: false };
    }
  });

  ipcMain.handle("get-clips", () => {
    return clips;
  });

  ipcMain.handle("delete-clip", (_event, args) => {
    try {
      const id = args?.id;
      if (typeof id !== "string") return { success: false };
      const idx = clips.findIndex((c) => c.id === id);
      if (idx === -1) {
        return { success: false };
      }
      clips.splice(idx, 1);
      saveClips();
      broadcastClips();
      return { success: true };
    } catch (err) {
      console.error("delete-clip error:", err);
      return { success: false };
    }
  });

  ipcMain.handle("clear-all", () => {
    try {
      clips = [];
      saveClips();
      broadcastClips();
      return { success: true };
    } catch (err) {
      console.error("clear-all error:", err);
      return { success: false };
    }
  });
}

app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  if (process.platform === "darwin") {
    app.dock.hide();
  }

  const iconPath = path.join(__dirname, "assets", "icon.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch (_) {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip("ClipClop");
  tray.on("click", () => {
    togglePopover();
  });

  setupIpc();
  loadClips();
  startClipboardMonitor();

  const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+V", () => {
    togglePopover();
  });
  if (!shortcutRegistered) {
    console.warn("Failed to register global shortcut CommandOrControl+Shift+V");
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopClipboardMonitor();
});

app.on("second-instance", () => {
  togglePopover();
});

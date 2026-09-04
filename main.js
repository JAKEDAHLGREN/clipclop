const { app, BrowserWindow, Tray, clipboard, ipcMain, nativeImage, screen, globalShortcut } = require("electron");
const path = require("path");
const ClipboardStore = require("./store");

const HISTORY_DIR = path.join(app.getPath("home"), ".clipclop");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");
const POLL_INTERVAL = 300;

const store = new ClipboardStore({ filePath: HISTORY_FILE });

let tray = null;
let popover = null;
let lastClipboardText = "";
let pollTimer = null;

function addClip(text) {
  store.add(text);
  broadcastClips();
}

function broadcastClips() {
  if (popover && popover.webContents && !popover.isDestroyed()) {
    popover.webContents.send("clips-updated", store.getAll());
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
    popover.webContents.send("clips-updated", store.getAll());
    });
    return;
  }
  if (popover.isVisible()) {
    popover.hide();
  } else {
    positionPopoverBelowTray();
    popover.show();
    popover.focus();
    popover.webContents.send("clips-updated", store.getAll());
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
      const clip = store.findById(id);
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
    return store.getAll();
  });

  ipcMain.handle("delete-clip", (_event, args) => {
    try {
      const id = args?.id;
      if (typeof id !== "string") return { success: false };
      if (!store.deleteById(id)) {
        return { success: false };
      }
      broadcastClips();
      return { success: true };
    } catch (err) {
      console.error("delete-clip error:", err);
      return { success: false };
    }
  });

  ipcMain.handle("clear-all", () => {
    try {
      store.clear();
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
  store.load();
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

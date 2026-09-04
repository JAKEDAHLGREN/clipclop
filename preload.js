const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clipclop", {
  copyItem: (id) => ipcRenderer.invoke("copy-to-clipboard", { id }),
  getClips: () => ipcRenderer.invoke("get-clips"),
  deleteClip: (id) => ipcRenderer.invoke("delete-clip", { id }),
  clearAll: () => ipcRenderer.invoke("clear-all"),
  onClipsUpdated: (cb) => ipcRenderer.on("clips-updated", (_e, clips) => cb(clips)),
  onCopied: (cb) => ipcRenderer.on("clipboard-copied", (_e, data) => cb(data)),
});

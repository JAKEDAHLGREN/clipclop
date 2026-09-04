const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clipclop", {
  copyItem: (id) => ipcRenderer.invoke("copy-to-clipboard", { id }),
  getClips: () => ipcRenderer.invoke("get-clips"),
  deleteClip: (id) => ipcRenderer.invoke("delete-clip", { id }),
  clearAll: () => ipcRenderer.invoke("clear-all"),
  onClipsUpdated: (cb) => {
    const handler = (_e, clips) => cb(clips);
    ipcRenderer.on("clips-updated", handler);
    return () => ipcRenderer.removeListener("clips-updated", handler);
  },
  onCopied: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("clipboard-copied", handler);
    return () => ipcRenderer.removeListener("clipboard-copied", handler);
  },
});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clipclop", {
  copyItem: (id) => ipcRenderer.invoke("copy-to-clipboard", { id }),
  getClips: () => ipcRenderer.invoke("get-clips"),
  deleteClip: (id) => ipcRenderer.invoke("delete-clip", { id }),
  clearAll: () => ipcRenderer.invoke("clear-all"),
  hide: () => ipcRenderer.invoke("hide-popover"),
  onClipsUpdated: (cb) => {
    const handler = (_e, clips) => cb(clips);
    ipcRenderer.on("clips-updated", handler);
    return () => ipcRenderer.removeListener("clips-updated", handler);
  },
  onShown: (cb) => {
    const handler = (_e, clips) => cb(clips);
    ipcRenderer.on("popover-shown", handler);
    return () => ipcRenderer.removeListener("popover-shown", handler);
  },
});

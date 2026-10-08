const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mapper", {
  loadGeoBinary: (fileName) => ipcRenderer.invoke("geo:load-binary", fileName),
  loadTemplate: (name) => ipcRenderer.invoke("mapping:load-template", name),
  newMap: () => ipcRenderer.invoke("mapping:new"),
  openMap: () => ipcRenderer.invoke("mapping:open"),
  saveMap: (json) => ipcRenderer.invoke("mapping:save", json),
  saveMapAs: (json) => ipcRenderer.invoke("mapping:save-as", json),
  currentPath: () => ipcRenderer.invoke("mapping:current-path"),
});

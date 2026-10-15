const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bradly", {
  version: "7.0.0",
  // Gioco
  launchGame: (exePath) => ipcRenderer.invoke("launch-game", exePath),
  getGamePath: () => ipcRenderer.invoke("get-game-path"),
  setGamePath: (path) => ipcRenderer.invoke("set-game-path", path),
  selectGameExe: () => ipcRenderer.invoke("select-game-exe"),
  // File browser
  getDrives: () => ipcRenderer.invoke("get-drives"),
  getQuickPaths: () => ipcRenderer.invoke("get-quick-paths"),
  listDirectory: (dirPath) => ipcRenderer.invoke("list-directory", dirPath),
  getParent: (dirPath) => ipcRenderer.invoke("get-parent", dirPath),
  searchFiles: (opts) => ipcRenderer.invoke("search-files", opts)
});
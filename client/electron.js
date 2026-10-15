const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("--disable-gpu");
app.commandLine.appendSwitch("--no-sandbox");

const configDir = path.join(app.getPath("userData"));
const configPath = path.join(configDir, "game-config.json");

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (e) {}
  return { gamePath: "" };
}

function saveConfig(data) {
  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { return false; }
}

// ============ IPC: FILESYSTEM ============
ipcMain.handle("get-drives", () => {
  const drives = [];
  if (process.platform === "win32") {
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i) + ":\\";
      try {
        if (fs.existsSync(letter)) {
          drives.push(letter);
        }
      } catch (e) {}
    }
  } else {
    drives.push("/");
  }
  return drives;
});

ipcMain.handle("get-quick-paths", () => {
  const home = app.getPath("home");
  const paths = [
    { label: "Desktop", path: path.join(home, "Desktop"), icon: "D" },
    { label: "Documenti", path: path.join(home, "Documents"), icon: "Doc" },
    { label: "Download", path: path.join(home, "Downloads"), icon: "DL" },
    { label: "Immagini", path: path.join(home, "Pictures"), icon: "Img" }
  ];
  // Aggiungi percorsi comuni Steam/Games se esistono
  const commonPaths = [
    { label: "Steam", path: "C:\\Program Files (x86)\\Steam\\steamapps\\common" },
    { label: "Steam (x64)", path: "C:\\Program Files\\Steam\\steamapps\\common" },
    { label: "Giochi", path: "C:\\Games" },
    { label: "Program Files (x86)", path: "C:\\Program Files (x86)" },
    { label: "Program Files", path: "C:\\Program Files" }
  ];
  commonPaths.forEach(p => {
    try { if (fs.existsSync(p.path)) paths.push(p); } catch (e) {}
  });
  return paths.filter(p => {
    try { return fs.existsSync(p.path); } catch (e) { return false; }
  });
});

ipcMain.handle("list-directory", (event, dirPath) => {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) {
      return { ok: false, error: "Percorso non valido" };
    }
    const items = fs.readdirSync(dirPath);
    const folders = [];
    const files = [];
    
    items.forEach(name => {
      try {
        const fullPath = path.join(dirPath, name);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          folders.push({ name, path: fullPath, type: "folder", size: 0 });
        } else if (stat.isFile()) {
          files.push({ name, path: fullPath, type: "file", size: stat.size, ext: path.extname(name).toLowerCase() });
        }
      } catch (e) {}
    });
    
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    
    return { ok: true, folders, files, path: dirPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("get-parent", (event, dirPath) => {
  try {
    const parent = path.dirname(dirPath);
    if (parent === dirPath) return { ok: true, parent: null };
    return { ok: true, parent };
  } catch (e) {
    return { ok: false, parent: null };
  }
});

ipcMain.handle("search-files", (event, { rootPath, query, maxDepth = 3 }) => {
  const results = [];
  const maxResults = 100;
  const lowerQuery = (query || "").toLowerCase();
  
  function searchDir(dir, depth) {
    if (depth > maxDepth || results.length >= maxResults) return;
    try {
      const items = fs.readdirSync(dir);
      for (const name of items) {
        if (results.length >= maxResults) return;
        try {
          const fullPath = path.join(dir, name);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            searchDir(fullPath, depth + 1);
          } else if (stat.isFile() && name.toLowerCase().includes(lowerQuery)) {
            results.push({ name, path: fullPath, type: "file", size: stat.size, ext: path.extname(name).toLowerCase() });
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  
  searchDir(rootPath, 0);
  return { ok: true, results };
});

ipcMain.handle("select-game-exe", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Seleziona Stronghold.exe",
      filters: [{ name: "Eseguibili", extensions: ["exe"] }],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    const p = result.filePaths[0];
    const cfg = loadConfig();
    cfg.gamePath = p;
    saveConfig(cfg);
    return { ok: true, path: p };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("set-game-path", (event, p) => {
  const cfg = loadConfig();
  cfg.gamePath = p;
  return { ok: saveConfig(cfg) };
});

ipcMain.handle("get-game-path", () => loadConfig().gamePath || "");

ipcMain.handle("launch-game", async (event, exePath) => {
  try {
    const cfg = loadConfig();
    const pathToLaunch = exePath || cfg.gamePath;
    if (!pathToLaunch || !fs.existsSync(pathToLaunch)) {
      return { ok: false, error: "Percorso non valido: " + pathToLaunch };
    }
    const dir = path.dirname(pathToLaunch);
    const child = spawn(pathToLaunch, [], { detached: true, stdio: "ignore", cwd: dir });
    child.unref();
    return { ok: true, path: pathToLaunch };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ============ FINESTRA ============
function findIndexHtml(dir, depth = 0) {
  if (depth > 8) return null;
  try {
    const files = fs.readdirSync(dir);
    if (files.includes("index.html")) return path.join(dir, "index.html");
    for (const f of files) {
      const full = path.join(dir, f);
      try {
        if (fs.statSync(full).isDirectory()) {
          const found = findIndexHtml(full, depth + 1);
          if (found) return found;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "BradlyStronghold",
    backgroundColor: "#0f1420",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.setMenuBarVisibility(false);

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
    return;
  }

  const resourcesPath = process.resourcesPath;
  const appPath = app.getAppPath();
  const candidates = [
    path.join(resourcesPath, "dist", "index.html"),
    path.join(resourcesPath, "app", "dist", "index.html"),
    path.join(appPath, "dist", "index.html"),
    path.join(__dirname, "dist", "index.html"),
    path.join(__dirname, "..", "dist", "index.html")
  ];

  let indexPath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { indexPath = p; break; }
  }
  if (!indexPath) indexPath = findIndexHtml(resourcesPath) || findIndexHtml(appPath);

  if (indexPath) win.loadFile(indexPath);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
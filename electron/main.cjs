const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const zlib = require("node:zlib");

const isDev = !app.isPackaged;
let mainWindow = null;
let currentFilePath = null;

function geoDir() {
  return isDev
    ? path.join(__dirname, "..", "resources", "geo", "out")
    : path.join(process.resourcesPath, "geo");
}

function templatesDir() {
  return isDev
    ? path.join(__dirname, "..", "resources", "templates")
    : path.join(process.resourcesPath, "templates");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#1b1e23",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  Menu.setApplicationMenu(null);

  const builtIndex = path.join(__dirname, "..", "app-dist", "index.html");
  if (!isDev || fs.existsSync(builtIndex)) {
    // Packaged app, or an unpackaged checkout that has been built with
    // `npm run build` - run standalone against the built files, no dev
    // server needed. This also lets the trusted electron.exe binary run the
    // finished app directly, sidestepping Smart App Control / SmartScreen
    // blocking an unsigned custom .exe on locked-down Windows machines.
    mainWindow.loadFile(builtIndex);
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("geo:load-binary", async (_evt, fileName) => {
  const file = path.join(geoDir(), fileName);
  const buf = await fs.promises.readFile(file);
  return buf.toString("base64");
});

// Templates ship gzipped (~1 MB instead of ~87 MB) so the repo stays under
// GitHub upload limits.
async function readTemplate(name) {
  const gz = await fs.promises.readFile(path.join(templatesDir(), `${name}.mapping.gz`));
  return zlib.gunzipSync(gz).toString("utf-8");
}

const TEMPLATE_NAMES = new Set(["world", "empty", "counties-as-countries", "usa-states", "europe", "ww1", "ww2"]);

ipcMain.handle("mapping:load-template", async (_evt, name) => {
  const safeName = TEMPLATE_NAMES.has(name) ? name : "world";
  return readTemplate(safeName);
});

ipcMain.handle("mapping:new", async () => {
  currentFilePath = null;
  return readTemplate("world");
});

ipcMain.handle("mapping:open", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Open Map",
    filters: [{ name: "Mapping Files", extensions: ["mapping"] }],
    properties: ["openFile"],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const filePath = res.filePaths[0];
  const content = await fs.promises.readFile(filePath, "utf-8");
  currentFilePath = filePath;
  return { filePath, content };
});

ipcMain.handle("mapping:save", async (_evt, jsonString) => {
  if (!currentFilePath) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: "Save Map",
      defaultPath: "world.mapping",
      filters: [{ name: "Mapping Files", extensions: ["mapping"] }],
    });
    if (res.canceled || !res.filePath) return null;
    currentFilePath = res.filePath;
  }
  await fs.promises.writeFile(currentFilePath, jsonString, "utf-8");
  return currentFilePath;
});

ipcMain.handle("mapping:save-as", async (_evt, jsonString) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "Save Map As",
    defaultPath: currentFilePath || "world.mapping",
    filters: [{ name: "Mapping Files", extensions: ["mapping"] }],
  });
  if (res.canceled || !res.filePath) return null;
  currentFilePath = res.filePath;
  await fs.promises.writeFile(currentFilePath, jsonString, "utf-8");
  return currentFilePath;
});

ipcMain.handle("mapping:current-path", async () => currentFilePath);

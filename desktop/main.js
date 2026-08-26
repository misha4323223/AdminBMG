const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, nativeImage, shell } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

/** 16×16 PNG с кругом цвета #d7dfee — иконка трея, генерируется на лету. */
function trayIcon() {
  const size = 16;
  const cx = 8, cy = 8, r = 6.2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    let row = Buffer.alloc(size, 0);
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= r) {
        // Замыленная кромка для сглаживания
        const a = Math.max(0, Math.min(1, r - d + 0.7));
        row[x] = Math.round(0xff * a);
      }
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows.map((row, y) => {
    const stride = size * 4 + 1;
    const line = Buffer.alloc(stride);
    line[0] = 0;
    for (let x = 0; x < size; x++) {
      const a = row[x];
      line[1 + x * 4] = 0x0b; // R
      line[1 + x * 4 + 1] = 0x0b; // G
      line[1 + x * 4 + 2] = 0x0f; // B
      line[1 + x * 4 + 3] = a; // A
    }
    return line;
  }));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const idat = zlib.deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return nativeImage.createFromBuffer(png);
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) | 0;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function distDir() {
  return app.isPackaged
    ? path.join(__dirname, "dist")
    : path.join(__dirname, "..", "dist");
}

/**
 * Читаем Ionicons TTF при запуске и создаём CSS с base64 data URI.
 * Шрифт встраивается прямо в HTML — никаких сетевых запросов для загрузки шрифта.
 * Expo-font тоже сможет его найти, т.к. @font-face зарегистрирован ДО любого JS.
 */
function buildIconFontCSS(root) {
  const ttfPath = path.join(
    root,
    "assets",
    "node_modules",
    "@expo",
    "vector-icons",
    "build",
    "vendor",
    "react-native-vector-icons",
    "Fonts",
    "Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf"
  );
  try {
    const buf = fs.readFileSync(ttfPath);
    const b64 = buf.toString("base64");
    const dataUri = `data:font/sfnt;base64,${b64}`;
    // Регистрируем под обоими именами — expo-font использует 'ionicons' (lowercase),
    // а Some-компоненты могут использовать 'Ionicons'
    return `<style id="electron-icon-font">\n@font-face{font-family:"ionicons";src:url("${dataUri}");font-weight:400;font-style:normal;font-display:swap;}\n@font-face{font-family:"Ionicons";src:url("${dataUri}");font-weight:400;font-style:normal;font-display:swap;}\n</style>`;
  } catch (e) {
    console.error("⚠️ Не удалось прочитать Ionicons.ttf:", e.message);
    return "";
  }
}

function startStaticServer() {
  const root = distDir();
  const iconFontCSS = buildIconFontCSS(root);

  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(
        new URL(req.url, "http://127.0.0.1").pathname
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (urlPath === "/") urlPath = "/index.html";

    let filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) {
        serve(filePath, res, iconFontCSS);
      } else {
        serve(path.join(root, "index.html"), res, iconFontCSS);
      }
    });
  });

  return new Promise((resolve) => {
    // Порт должен быть ОДНИМ И ТЕМ ЖЕ при каждом запуске: localStorage привязан к адресу
    // 127.0.0.1:ПОРТ — если порт меняется, хранилище выглядит пустым и вход слетает.
    let preferred = 0;
    try {
      const n = parseInt(fs.readFileSync(path.join(app.getPath("userData"), "server-port.txt"), "utf-8"), 10);
      if (Number.isInteger(n) && n > 1024 && n < 65536) preferred = n;
    } catch {}
    const remember = () => {
      try {
        fs.writeFileSync(path.join(app.getPath("userData"), "server-port.txt"), String(server.address().port));
      } catch {}
    };
    server.once("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        // Порт занят (редко) — берём случайный и перезапоминаем
        server.listen(0, "127.0.0.1", () => {
          remember();
          resolve(server);
        });
      }
    });
    server.listen(preferred || 0, "127.0.0.1", () => {
      remember();
      resolve(server);
    });
  });
}

function serve(filePath, res, iconFontCSS) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end();
      return;
    }
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };

    if (ext === ".html") {
      let html = data.toString("utf-8");
      // Вставляем base64-шрифт прямо в <head> — ДО всех <script>
      if (iconFontCSS) {
        html = html.replace("<head>", `<head>\n${iconFontCSS}`);
      }
      res.writeHead(200, headers);
      res.end(html, "utf-8");
      return;
    }

    res.writeHead(200, headers);
    res.end(data);
  });
}

function stripOriginForApi(session) {
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.startsWith("https://booomerangs.ru/")) {
      const requestHeaders = { ...details.requestHeaders };
      delete requestHeaders["Origin"];
      delete requestHeaders["origin"];
      callback({ requestHeaders });
      return;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

let tray = null;
let mainWin = null;

function buildTray(win) {
  const icon = trayIcon();
  tray = new Tray(icon);
  tray.setToolTip("BOOOMERANGS Админка");
  tray.setContextMenu(buildTrayMenu(win));
  tray.on("click", () => { win.show(); win.focus(); });
}

function setupIpc(win) {
  ipcMain.on("admin:toggle-always-on-top", () => {
    win.setAlwaysOnTop(!win.isAlwaysOnTop());
    if (tray) tray.setContextMenu(buildTrayMenu(win));
  });
  ipcMain.on("admin:minimize-to-tray", () => {
    win.hide();
  });
}

function buildTrayMenu(win) {
  const menu = Menu.buildFromTemplate([
    { label: "Открыть админку", click: () => { win.show(); win.focus(); } },
    {
      label: "Поверх всех окон",
      type: "checkbox",
      checked: win.isAlwaysOnTop(),
      click: (item) => win.setAlwaysOnTop(item.checked),
    },
    { type: "separator" },
    { label: "Выход", click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  return menu;
}

async function createWindow(server) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    title: "BOOOMERANGS Админка",
    autoHideMenuBar: true,
    backgroundColor: "#0b0b0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWin = win;

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL() && url.startsWith("https://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  stripOriginForApi(win.webContents.session);
  setupIpc(win);

  // Закрытие окна — в трей, а не выход (кроме явного «Выход»).
  win.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  const address = server.address();
  await win.loadURL(`http://127.0.0.1:${address.port}`);
  buildTray(win);
}

app.whenReady().then(async () => {
  const server = await startStaticServer();
  await createWindow(server);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(server);
  });
});

app.on("window-all-closed", () => {
  // Окно скрывается в трей, а не закрывается — приложение живёт в фоне.
  if (process.platform !== "darwin" && app.isQuitting) app.quit();
});

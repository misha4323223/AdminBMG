const { app, BrowserWindow, shell } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");

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
    },
  });

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

  const address = server.address();
  await win.loadURL(`http://127.0.0.1:${address.port}`);
}

app.whenReady().then(async () => {
  const server = await startStaticServer();
  await createWindow(server);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(server);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

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

// Собираем приложение из web-сборки (dist), которую подкладывает build-win.mjs.
// В unpackaged-режиме берём ../dist из корня проекта.
function distDir() {
  return app.isPackaged
    ? path.join(__dirname, "dist")
    : path.join(__dirname, "..", "dist");
}

// Мини-статический сервер на 127.0.0.1 (только локально, порт случайный).
// Нужен, чтобы web-сборка работала из под Electron (абсолютные пути /_expo/...).
function startStaticServer() {
  const root = distDir();
  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
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
        serve(filePath, res);
      } else {
        // SPA-fallback: любые неизвестные пути отдаём index.html
        serve(path.join(root, "index.html"), res);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function serve(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// Приложение ходит в https://booomerangs.ru/api напрямую. Из окна Electron
// браузер добавит Origin, который сервер может не пропустить (CORS).
// Убираем Origin для запросов к API — сервер обрабатывает их как обычного клиента.
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
      sandbox: true,
    },
  });

  // Внешние ссылки — в системный браузер, а не внутрь окна
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

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Безопасный мост между рендерером (web-сборка) и main-процессом.
 * Доступен как window.adminDesktop (только внутри Electron).
 */
contextBridge.exposeInMainWorld("adminDesktop", {
  /** Переключить «поверх всех окон». */
  toggleAlwaysOnTop: () => ipcRenderer.send("admin:toggle-always-on-top"),
  /** Свернуть в трей. */
  minimizeToTray: () => ipcRenderer.send("admin:minimize-to-tray"),
  /** Признак десктоп-сборки для веб-кода. */
  isDesktop: true,
});

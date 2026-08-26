/**
 * Типизированный доступ к десктоп-мосту Electron (см. desktop/preload.js).
 * На web-браузере и нативе все функции — безопасные no-op.
 */

interface DesktopBridge {
  isDesktop: boolean;
  toggleAlwaysOnTop: () => void;
  minimizeToTray: () => void;
}

declare global {
  interface Window {
    adminDesktop?: DesktopBridge;
  }
}

/** Запущено ли приложение внутри Electron. */
export function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.adminDesktop?.isDesktop;
}

export function toggleAlwaysOnTop(): void {
  window.adminDesktop?.toggleAlwaysOnTop();
}

export function minimizeToTray(): void {
  window.adminDesktop?.minimizeToTray();
}

/** Системное уведомление (Electron/браузер). Возвращает false, если недоступно. */
export function notify(title: string, body: string): boolean {
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "denied") return false;
    if (Notification.permission === "default" && !isDesktop()) return false; // не просим разрешение в браузере
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

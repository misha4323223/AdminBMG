/**
 * Горячие клавиши для ПК (web/Electron). Работает только на web-платформе;
 * на нативе слушатель не устанавливается.
 *
 * Обработчики регистрируются с приоритетом: срабатывает только первый
 * подходящий (например, Esc закрывает палитру, а не уходит назад).
 */

interface ShortcutEntry {
  id: string;
  /** key — как в KeyboardEvent.key (без модификаторов) */
  key: string;
  ctrl: boolean;
  alt: boolean;
  priority: number;
  handler: () => void;
}

const entries: ShortcutEntry[] = [];
let installed = false;

export function registerHotkey(
  id: string,
  combo: { key: string; ctrl?: boolean; alt?: boolean },
  handler: () => void,
  priority = 0,
): () => void {
  const entry: ShortcutEntry = {
    id,
    key: combo.key.toLowerCase(),
    ctrl: !!combo.ctrl,
    alt: !!combo.alt,
    priority,
    handler,
  };
  entries.push(entry);
  ensureInstalled();
  return () => unregisterHotkey(id);
}

export function unregisterHotkey(id: string): void {
  const i = entries.findIndex((e) => e.id === id);
  if (i !== -1) entries.splice(i, 1);
}

function ensureInstalled(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const alt = e.altKey;
    const key = e.key.toLowerCase();
    const matches = entries
      .filter((en) => en.key === key && en.ctrl === ctrl && en.alt === alt)
      .sort((a, b) => b.priority - a.priority);
    if (matches.length === 0) return;
    e.preventDefault();
    matches[0].handler();
  });
}

/** Клавиша нажата в «пустом» месте (не в текстовом поле) — для Esc и т.п. */
export function isTypingTarget(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

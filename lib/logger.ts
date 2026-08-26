/**
 * Мини-логгер приложения: уровни (info/warn/error) + кольцевой буфер
 * последних записей в памяти. Буфер показывается в разделе «Диагностика» —
 * когда пользователь говорит «у меня упало», видно что именно.
 * В dev-режиме дублирует записи в console.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  /** ISO-время записи */
  at: string;
  /** Необязательный контекст (имя экрана/модуля, статус HTTP и т.п.) */
  context?: string;
}

const MAX_ENTRIES = 50;
const buffer: LogEntry[] = [];
const listeners = new Set<(entries: LogEntry[]) => void>();

function push(level: LogLevel, message: string, context?: string) {
  const entry: LogEntry = {
    level,
    message,
    context,
    at: new Date().toISOString(),
  };
  buffer.unshift(entry);
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES;

  if (__DEV__) {
    const tag = `[AdminBMG:${level}]${context ? ` (${context})` : ""}`;
    if (level === "error") console.error(tag, message);
    else if (level === "warn") console.warn(tag, message);
    else console.log(tag, message);
  }

  for (const fn of listeners) {
    try {
      fn([...buffer]);
    } catch {
      // слушатель не должен ломать логгер
    }
  }
}

export const logger = {
  info(message: string, context?: string) {
    push("info", message, context);
  },
  warn(message: string, context?: string) {
    push("warn", message, context);
  },
  error(message: string, context?: string) {
    push("error", message, context);
  },

  /** Последние записи (новые сверху). */
  entries(): LogEntry[] {
    return [...buffer];
  },

  clear() {
    buffer.length = 0;
    for (const fn of listeners) fn([]);
  },

  /** Подписка на изменения буфера (для реактивного UI). Возвращает отписку. */
  subscribe(fn: (entries: LogEntry[]) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

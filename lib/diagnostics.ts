import axios from "axios";
import { apiGet, API_BASE_URL, toApiError } from "./api";
import { logger } from "./logger";

/**
 * Диагностика: живость сервера (/healthz) + дымовые проверки ключевых
 * админ-API с замером латентности. Работает и до деплоя Фазы 0 на сайт:
 * если /healthz ещё нет (404) — это не ошибка, а «эндпоинт недоступен»,
 * дымовые проверки обычных маршрутов всё равно показывают состояние.
 */

export type CheckStatus = "ok" | "warn" | "fail" | "skipped";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  /** Время ответа в мс */
  ms?: number;
  detail?: string;
}

export interface DiagnosticsReport {
  ranAt: string;
  server: CheckResult;
  checks: CheckResult[];
  /**
   * Подробная диагностика сервера: журнал, статистика запросов, кэш.
   * Источник — эндпоинты /api/admin/diagnostics/* (появляются после деплоя
   * сайта; пока их нет — блоки помечаются state: "deploy").
   */
  serverDetail: ServerDiagnostics;
  /** Общий вердикт: ok — всё зелёное, warn — есть замечания, fail — критично */
  verdict: "ok" | "warn" | "fail";
}

/** Порог латентности, выше которого проверка жёлтая (мс). */
const SLOW_MS = 1500;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; result?: T; error?: unknown }> {
  const started = Date.now();
  try {
    const result = await fn();
    return { ms: Date.now() - started, result };
  } catch (error) {
    return { ms: Date.now() - started, error };
  }
}

function classify(error: unknown): { status: CheckStatus; detail: string } {
  if (axios.isAxiosError(error)) {
    const s = error.response?.status;
    if (error.code === "ECONNABORTED" || !error.response) {
      return { status: "fail", detail: "Нет связи с сервером (таймаут или сеть)" };
    }
    if (s === 401 || s === 403) {
      return { status: "warn", detail: `Сервер ответил ${s} — проверьте API-ключ` };
    }
    return { status: "fail", detail: `HTTP ${s ?? "?"} — ${(toApiError(error).message || "").slice(0, 80)}` };
  }
  return { status: "fail", detail: String((error as Error)?.message || error).slice(0, 100) };
}

/**
 * Живость сервера: /healthz в корне домена (без префикса /api).
 * axios-клиент apiGet цепляет базовый URL .../api, а prod-эндпоинт живёт
 * на https://booomerangs.ru/healthz — поэтому ходим на него сами (raw fetch),
 * как это делает uploadImage(). Формат ответа — реальный контракт прода.
 */
export async function checkServerHealth(): Promise<CheckResult> {
  const rootBase = API_BASE_URL.replace(/\/api\/?$/, "");
  const url = `${rootBase}/healthz`;

  const { ms, result, error } = await timed(() =>
    fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }).then(async (res) => {
      if (!res.ok) throw new HttpStatusError(res.status);
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/json")) {
        // HTML/SPA-заглушка — эндпоинт отдаёт страницу сайта, а не healthz.
        return { __spa: true };
      }
      return await res.json();
    }),
  );

  // Пришла не JSON-структура (страница сайта/SPA) — эндпоинт не задеплоен/неверный.
  if (!error && result && (result as Record<string, unknown>).__spa === true) {
    return {
      id: "server",
      label: "Сервер (/healthz)",
      status: "skipped",
      ms,
      detail: "Эндпоинт ещё не задеплоен (сервер отдаёт страницу сайта)",
    };
  }

  if (!error && result && typeof result === "object") {
    const data = result as Record<string, unknown>;
    const ydb = data.ydb && typeof data.ydb === 'object'
      ? data.ydb as Record<string, unknown>
      : undefined;
    // Продакшн-контракт: { status: "ok", ydb: { ok: true }, uptimeSec, memory: { heapUsed } }.
    const db =
      ydb?.ok === true ||
      data.db === true ||
      data.database === true ||
      data.status === "ok";
    const mem =
      typeof data.memory === "object" && data.memory !== null
        ? data.memory as Record<string, unknown>
        : undefined;
    const memMb = mem?.heapUsed ? Math.round(Number(mem.heapUsed) / 1024 / 1024) : undefined;
    const uptimeNum = typeof data.uptimeSec === "number"
      ? data.uptimeSec
      : typeof data.uptime === "number"
        ? data.uptime
        : undefined;
    return {
      id: "server",
      label: "Сервер (/healthz)",
      status: db ? "ok" : "warn",
      ms,
      detail: [
        db ? "БД отвечает" : "БД: нет данных",
        uptimeNum != null ? `uptime ${Math.round(uptimeNum / 60)} мин` : null,
        memMb != null ? `память ~${memMb} МБ` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  // /healthz вернул 404 — эндпоинт ещё не задеплоен. Это НЕ падение сервера.
  if (error instanceof HttpStatusError && error.status === 404) {
    return {
      id: "server",
      label: "Сервер (/healthz)",
      status: "skipped",
      detail: "Эндпоинт недоступен (404) — появится после деплоя сайта",
    };
  }
  const c = classify(error);
  return { id: "server", label: "Сервер (/healthz)", status: c.status, ms, detail: c.detail };
}

/** Небольшой класс, чтобы различить HTTP-статус при raw fetch (без axios). */
class HttpStatusError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

/** Ключевые маршруты, которые должны отвечать у залогиненного админа. */
const SMOKE_CHECKS: Array<{ url: string; label: string; heavyNote?: string }> = [
  // ВАЖНО: список товаров — это публичный /products?limit=&admin=true
  // (сервер даёт до 5000 позиций), а не /admin/products (такого GET-маршрута
  // на сервере нет → был бы ложный 404 в диагностике).
  { url: "/products?limit=1&admin=true", label: "Товары" },
  {
    url: "/admin/orders",
    label: "Заказы",
    heavyNote: "тяжёлый маршрут — сервер отдаёт все заказы без лимита",
  },
  { url: "/admin/users", label: "Клиенты" },
  { url: "/page-settings/home", label: "Секции главной" },
];

/** Дымовая проверка одного маршрута: должен ответить без сетевой ошибки. */
async function smokeCheck(url: string, label: string, heavyNote?: string): Promise<CheckResult> {
  const { ms, error } = await timed(() => apiGet(url, { timeout: 12000 }));
  if (!error) {
    return {
      id: url,
      label,
      status: ms > SLOW_MS ? "warn" : "ok",
      ms,
      detail:
        ms > SLOW_MS
          ? `Отвечает медленно${heavyNote ? ` (${heavyNote})` : ""}`
          : `${API_BASE_URL.replace(/^https?:\/\//, "")}`,
    };
  }
  const c = classify(error);
  logger.error(`Дымовая проверка провалена: ${label}`, `HTTP/сеть · ${c.detail}`);
  return { id: url, label, ...c, ms };
}

/** --- Подробная диагностика сервера: /api/admin/diagnostics/* --- */

export type DetailState = "ok" | "deploy" | "auth" | "error";

export interface ServerDetailBlock<T> {
  id: string;
  label: string;
  state: DetailState;
  /** Отклик эндпоинта в мс */
  ms?: number;
  data?: T;
  detail?: string;
}

export interface ServerLogEntry {
  ts: number;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

export interface ServerRequestStat {
  method: string;
  path: string;
  status: number;
  ms: number;
  ts: number;
}

export interface ServerRequestStats {
  total: number;
  byStatus: Record<string, number>; // "2xx" | "3xx" | "4xx" | "5xx"
  avgMs: number;
  p95Ms: number;
  slowest: ServerRequestStat[];
  errorsLastHour: number;
}

export interface ServerCacheEntry {
  size: number;
  ttlSec?: number;
  ageSec?: number | null;
}

export type ServerCacheState = Record<string, ServerCacheEntry>;

export interface ServerDiagnostics {
  logs: ServerDetailBlock<ServerLogEntry[]>;
  requests: ServerDetailBlock<ServerRequestStats>;
  cache: ServerDetailBlock<ServerCacheState>;
}

/** Запрос к эндпоинту подробной диагностики с мягкой обработкой «ещё не задеплоен». */
async function fetchServerDetail<T>(
  path: string,
): Promise<{ ms: number; state: DetailState; data?: T; detail?: string }> {
  const { ms, result, error } = await timed(() => apiGet<T>(path, { timeout: 8000 }));
  if (!error) {
    return { ms, state: "ok", data: result };
  }
  if (axios.isAxiosError(error)) {
    const s = error.response?.status;
    if (s === 404) {
      return { ms, state: "deploy", detail: "Эндпоинт появится после деплоя сайта" };
    }
    if (s === 401 || s === 403) {
      return { ms, state: "auth", detail: `Сервер ответил ${s} — проверьте API-ключ` };
    }
    return {
      ms,
      state: "error",
      detail: `HTTP ${s ?? "?"} — ${(toApiError(error).message || "").slice(0, 80)}`,
    };
  }
  return { ms, state: "error", detail: String((error as Error)?.message || error).slice(0, 100) };
}

async function checkServerLogs(): Promise<ServerDetailBlock<ServerLogEntry[]>> {
  // level=warn — по контракту сервера возвращает warn+error (info сейчас пуст).
  const { ms, state, data, detail } = await fetchServerDetail<{ ok: boolean; logs: ServerLogEntry[] }>(
    "/admin/diagnostics/logs?level=warn&limit=50",
  );
  return { id: "logs", label: "Журнал сервера", state, ms, data: data?.logs, detail };
}

async function checkServerRequests(): Promise<ServerDetailBlock<ServerRequestStats>> {
  const { ms, state, data, detail } = await fetchServerDetail<{
    ok: boolean;
    stats: ServerRequestStats;
  }>("/admin/diagnostics/requests?minutes=60");
  return { id: "requests", label: "Запросы (60 мин)", state, ms, data: data?.stats, detail };
}

async function checkServerCache(): Promise<ServerDetailBlock<ServerCacheState>> {
  const { ms, state, data, detail } = await fetchServerDetail<{
    ok: boolean;
    cache: ServerCacheState;
  }>("/admin/diagnostics/cache");
  return { id: "cache", label: "Кэш сервера", state, ms, data: data?.cache, detail };
}

/** Полный прогон диагностики. */
export async function runDiagnostics(): Promise<DiagnosticsReport> {
  logger.info("Запуск диагностики");
  const [server, checks, logs, requests, cache] = await Promise.all([
    checkServerHealth(),
    Promise.all(SMOKE_CHECKS.map((c) => smokeCheck(c.url, c.label, c.heavyNote))),
    checkServerLogs(),
    checkServerRequests(),
    checkServerCache(),
  ]);

  const all = [server, ...checks];
  const hasFail = all.some((c) => c.status === "fail");
  const hasWarn = all.some((c) => c.status === "warn");
  // Недоступность (404 = ещё не задеплоен) — не проблема; ошибка/401 — замечание.
  const detailBroken = [logs, requests, cache].some((b) => b.state === "error" || b.state === "auth");
  const verdict = hasFail ? "fail" : hasWarn || detailBroken ? "warn" : "ok";

  const report: DiagnosticsReport = {
    ranAt: new Date().toISOString(),
    server,
    checks,
    serverDetail: { logs, requests, cache },
    verdict,
  };

  if (verdict === "fail") logger.error("Диагностика: есть критичные проблемы");
  else if (verdict === "warn") logger.warn("Диагностика: есть замечания");
  else logger.info("Диагностика: всё в порядке");

  return report;
}

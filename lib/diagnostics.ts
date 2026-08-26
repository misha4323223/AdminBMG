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

/** Живость сервера: /healthz (после деплоя Фазы 0) с мягким фолбэком при 404. */
export async function checkServerHealth(): Promise<CheckResult> {
  const { ms, result, error } = await timed(() =>
    apiGet<Record<string, unknown>>("/healthz", { timeout: 8000 }),
  );

  // Если пришёл не JSON-объект (например, HTML-заглушка SPA для неизвестных
  // маршрутов со статусом 200) — настоящий /healthz ещё не задеплоен.
  if (!error && result && typeof result !== "object") {
    return {
      id: "server",
      label: "Сервер (/healthz)",
      status: "skipped",
      ms,
      detail: "Эндпоинт ещё не задеплоен (сервер отдаёт страницу сайта)",
    };
  }

  if (!error && result) {
    const data = result as Record<string, unknown>;
    const db = data.db === true || data.database === true || data.ok === true;
    const mem = typeof data.memory === "object" && data.memory !== null
      ? data.memory as Record<string, unknown>
      : undefined;
    const memMb = mem?.heapUsed ? Math.round(Number(mem.heapUsed) / 1024 / 1024) : undefined;
    return {
      id: "server",
      label: "Сервер (/healthz)",
      status: db ? "ok" : "warn",
      ms,
      detail: [
        db ? "БД отвечает" : "БД: нет данных",
        typeof data.uptime === "number" ? `uptime ${Math.round(data.uptime / 60)} мин` : null,
        memMb != null ? `память ~${memMb} МБ` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  // /healthz ещё не задеплоен — это НЕ падение сервера.
  if (axios.isAxiosError(error) && error.response?.status === 404) {
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

/** Ключевые маршруты, которые должны отвечать у залогиненного админа. */
const SMOKE_CHECKS: Array<{ url: string; label: string; heavyNote?: string }> = [
  { url: "/admin/products?limit=1", label: "Товары" },
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

/** Полный прогон диагностики. */
export async function runDiagnostics(): Promise<DiagnosticsReport> {
  logger.info("Запуск диагностики");
  const server = await checkServerHealth();
  const checks = await Promise.all(
    SMOKE_CHECKS.map((c) => smokeCheck(c.url, c.label, c.heavyNote)),
  );

  const all = [server, ...checks];
  const hasFail = all.some((c) => c.status === "fail");
  const hasWarn = all.some((c) => c.status === "warn");
  const verdict = hasFail ? "fail" : hasWarn ? "warn" : "ok";

  const report: DiagnosticsReport = {
    ranAt: new Date().toISOString(),
    server,
    checks,
    verdict,
  };

  if (verdict === "fail") logger.error("Диагностика: есть критичные проблемы");
  else if (verdict === "warn") logger.warn("Диагностика: есть замечания");
  else logger.info("Диагностика: всё в порядке");

  return report;
}

import axios from "axios";
import { apiGet, toApiError } from "./api";

/**
 * Яндекс.Метрика: панель e-commerce-отчётов и аналитики трафика.
 * Источник — эндпоинты /api/admin/yandex-metrika/* (агентский слой поверх API
 * Метрики, токен читается на сервере из env YANDEX_METRIKA_OAUTH_TOKEN).
 *
 * Контракт 1-в-1 с сервером (server/routes/yandex-metrika.ts). Все отчётные
 * эндпоинты принимают from/to (Metrika: "7daysAgo", "30daysAgo", "2024-01-01", "today")
 * и отдают стандартный формат /stat/v1/data: { data: [{ dimensions:[...], metrics:[числа] }] }.
 *
 * Пока эндпоинт не отвечает (сервер без секрета) — состояния мягкие:
 * "configured:false" → «нужно добавить секрет», 404 → «появится после деплоя».
 */

export type MetrikaState = "ok" | "unconfigured" | "auth" | "error" | "deploy";

export interface MetrikaBlock<T> {
  id: string;
  label: string;
  state: MetrikaState;
  ms?: number;
  data?: T;
  detail?: string;
}

export interface MetrikaStatus {
  configured?: boolean;
  counterId?: string;
  error?: string;
}

export interface MetrikaRow {
  dimensions?: Array<{ name?: string }>;
  metrics?: number[];
}

export interface MetrikaReport {
  data?: MetrikaRow[];
  error?: string;
}

export interface MetrikaGoalReaches {
  id: number;
  name: string;
  reaches: number;
}

export type MetrikaGoals = {
  goals?: MetrikaGoalReaches[];
  error?: string;
};

/** Пресеты периода для селектора. */
export type MetrikaPeriodKey = "7d" | "30d" | "90d" | "today" | "yesterday";

export interface MetrikaPeriod {
  key: MetrikaPeriodKey;
  label: string;
  from: string;
  to: string;
}

export const METRIKA_PERIODS: MetrikaPeriod[] = [
  { key: "today", label: "Сегодня", from: "today", to: "today" },
  { key: "yesterday", label: "Вчера", from: "2daysAgo", to: "1daysAgo" },
  { key: "7d", label: "7 дней", from: "7daysAgo", to: "today" },
  { key: "30d", label: "30 дней", from: "30daysAgo", to: "today" },
  { key: "90d", label: "90 дней", from: "90daysAgo", to: "today" },
];

export function getMetrikaPeriod(key: MetrikaPeriodKey): MetrikaPeriod {
  return METRIKA_PERIODS.find((p) => p.key === key) ?? METRIKA_PERIODS[2];
}

/** Слайс метрик для summary (order: что храним в totals). */
export interface MetrikaTotals {
  visits: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  revenue: number;
  purchases: number;
}

/**
 * Мягкий разбор ответа эндпоинта. 503/configured:false → «unconfigured»,
 * 401/403 → «auth», 404 → «deploy», 502 → «error».
 */
async function fetchMetrika<T>(
  path: string,
): Promise<{ ms: number; state: MetrikaState; data?: T; detail?: string }> {
  const started = Date.now();
  try {
    const result = await apiGet<T>(path, { timeout: 15000 });
    return { ms: Date.now() - started, state: "ok", data: result };
  } catch (error) {
    const ms = Date.now() - started;
    if (axios.isAxiosError(error)) {
      const s = error.response?.status;
      // configured:false (503) — секрета YANDEX_METRIKA_OAUTH_TOKEN нет на сервере.
      if (s === 503) {
        const body = error.response?.data as { configured?: boolean; error?: string } | undefined;
        return body?.configured === false
          ? { ms, state: "unconfigured", detail: body.error || "Yandex Metrika не настроена" }
          : { ms, state: "error", detail: body?.error || `HTTP ${s}` };
      }
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
}

function reportFrom(res: MetrikaBlock<MetrikaReport>): MetrikaBlock<MetrikaReport> {
  return res;
}

/** Подключение и номер счётчика. */
export async function loadMetrikaStatus(): Promise<MetrikaBlock<MetrikaStatus>> {
  const res = await fetchMetrika<MetrikaStatus>("/admin/yandex-metrika/status");
  return { id: "status", label: "Подключение", ...res };
}

/** По источникам трафика за период. */
export async function loadMetrikaSummary(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaReport>> {
  const res = await fetchMetrika<MetrikaReport>(
    `/admin/yandex-metrika/summary?from=${period.from}&to=${period.to}`,
  );
  return reportFrom({ id: "summary", label: "Сводка", ...res });
}

/** Топ товаров e-commerce по выручке за период. */
export async function loadMetrikaProducts(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaReport>> {
  const res = await fetchMetrika<MetrikaReport>(
    `/admin/yandex-metrika/products?from=${period.from}&to=${period.to}`,
  );
  return reportFrom({ id: "products", label: "Товары", ...res });
}

/** Визиты/пользователи/просмотры/выручка/покупки по дням (для графика). */
export async function loadMetrikaDaily(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaReport>> {
  const res = await fetchMetrika<MetrikaReport>(
    `/admin/yandex-metrika/daily?from=${period.from}&to=${period.to}`,
  );
  return reportFrom({ id: "daily", label: "По дням", ...res });
}

/** Продажи товара по дням (композит товар×дата). */
export async function loadMetrikaProductDates(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaReport>> {
  const res = await fetchMetrika<MetrikaReport>(
    `/admin/yandex-metrika/product-dates?from=${period.from}&to=${period.to}`,
  );
  return reportFrom({ id: "product-dates", label: "Продажи по дням", ...res });
}

/** Популярные страницы входа. */
export async function loadMetrikaPages(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaReport>> {
  const res = await fetchMetrika<MetrikaReport>(
    `/admin/yandex-metrika/pages?from=${period.from}&to=${period.to}`,
  );
  return reportFrom({ id: "pages", label: "Страницы", ...res });
}

/** Устройства (смартфоны/десктопы/планшеты). */
export async function loadMetrikaDevices(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaReport>> {
  const res = await fetchMetrika<MetrikaReport>(
    `/admin/yandex-metrika/devices?from=${period.from}&to=${period.to}`,
  );
  return reportFrom({ id: "devices", label: "Устройства", ...res });
}

/** Топ городов. */
export async function loadMetrikaGeo(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaReport>> {
  const res = await fetchMetrika<MetrikaReport>(
    `/admin/yandex-metrika/geo?from=${period.from}&to=${period.to}`,
  );
  return reportFrom({ id: "geo", label: "Города", ...res });
}

/** Достижения целей за период (формат GET .../goals-stats). */
export async function loadMetrikaGoals(period: MetrikaPeriod): Promise<MetrikaBlock<MetrikaGoals>> {
  const res = await fetchMetrika<MetrikaGoals>(
    `/admin/yandex-metrika/goals-stats?from=${period.from}&to=${period.to}`,
  );
  return { id: "goals", label: "Цели", ...res };
}

/**
 * Суммирует summary-метрики по всем строкам (индексы сервера):
 * 0 — visits, 1 — users, 2 — pageviews, 3 — bounceRate, 4 — revenue, 5 — purchases.
 */
export function summarizeMetrika(rows: MetrikaRow[] | undefined): MetrikaTotals {
  const totals = { visits: 0, users: 0, pageviews: 0, bounceRate: 0, revenue: 0, purchases: 0 };
  for (const row of rows || []) {
    const m = row.metrics || [];
    totals.visits += Number(m[0] ?? 0);
    totals.users += Number(m[1] ?? 0);
    totals.pageviews += Number(m[2] ?? 0);
    totals.bounceRate += Number(m[3] ?? 0);
    totals.revenue += Number(m[4] ?? 0);
    totals.purchases += Number(m[5] ?? 0);
  }
  return totals;
}
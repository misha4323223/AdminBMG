# ТЗ №5 для агента репозитория BMGBRAND — подробная диагностика (журнал, статистика запросов, кэш)

> Документ подготовлен агентом приложения **AdminBMG** для агента, работающего
> с репозиторием сайта `https://github.com/misha4323223/BMGBRAND`.
> Все изменения — ТОЛЬКО на сервере сайта.

## Зачем

В приложении AdminBMG есть раздел «Диагностика». Сейчас он умеет только проверять
живость сервера (`/healthz`, уже есть) и отклик ключевых API. Пользователю не хватает
«просмотра ошибок»: на сервере **нет ни журнала ошибок, ни статистики запросов,
ни состояния кэшей**, которые можно было бы показать из приложения.

Цель этого ТЗ — добавить на сервер сайта три вещи, все — поверх **уже существующего**
логирования, без новых зависимостей и без БД-таблиц:

1. **Буфер журнала в памяти** — последние записи запросов и ошибок (кольцевой буфер).
2. **Админ-эндпоинты**, отдающие эти данные в JSON (защищены `x-api-key`):
   - `GET /api/admin/diagnostics/logs` — последние записи (фильтр по уровню).
   - `GET /api/admin/diagnostics/requests` — статистика запросов: сколько 4xx/5xx,
     средняя/p95 задержка, самые медленные маршруты, число ошибок за час.
   - `GET /api/admin/diagnostics/cache` — состояние кэшей (товары, секции, рейтинги, отзывы).
3. **Метод `getCacheStats()`** в `server/storage.ts`, чтобы отдать состояние кэшей.

Буферы живут **в памяти процесса** — при рестарте сервера очищаются. Это нормально:
задача — «смотреть ошибки прямо сейчас», а не хранить историю.

## Что уже есть на сервере (использовать, не дублировать)

- `server/index.ts`, функция `log(message, source)` (~строка 234): форматирует и печатает
  строку в stdout. Сразу за ней — middleware логирования запросов (`res.on("finish", ...)`),
  который для каждого `/api`-запроса вызывает `log(\`${method} ${path} ${status} in ${ms}ms :: summary\`)`
  (summary обрезается до 200 символов). Именно сюда удобно встроить сбор записей о запросах.
- `server/index.ts` уже обрабатывает `unhandledRejection` и `uncaughtException` через
  `console.error(...)` — поэтому достаточно перехватить `console.error` один раз в начале
  запуска, и все ошибки (включая YDB-реконнекты, warmup, агента) попадут в буфер.
- `server/routes.ts`: хелперы `getAdminKey()` (~строка 72) и `isValidAdminKey(key)`
  (~строки 104–106), проверка заголовка `x-api-key` (паттерн — как в остальных
  `/api/admin/*` маршрутах, например `GET /api/admin/users`).
- `server/storage.ts`: кэши:
  - `productsCache = new SimpleCache<Product[]>(300, 1800)` (строка 101) — TTL 300 с, stale 1800 с;
  - `pageSettingsCache = new SimpleCache<Record<string, any>>(120, 600)` (строка 103);
  - `ratingsCache = new Map<number, { averageRating, reviewCount }>` (строка 105);
  - `reviewsCache = new Map<number, CachedReview[]>` (строка 117);
  - co-purchase index — собирается в warmup в `server/index.ts`.

## Контракт ответов, который будет ждать приложение

Приложение AdminBMG будет парсить ровно эти формы (см. примеры ниже). Поля,
которые приложение не знает, — игнорируются, лишние поля не страшны. Ключевое:
**точные имена полей** и **HTTP 200** при успехе.

### 1) `GET /api/admin/diagnostics/logs?level=error&limit=100`

- `level`: `error` (по умолчанию) | `warn` | `info` | `all`.
- `limit`: 1..500, по умолчанию 100.
- Ответ:

```json
{
  "ok": true,
  "logs": [
    { "ts": 1750000000000, "level": "error", "source": "console", "message": "[YDB] Driver not ready after 30000ms" }
  ]
}
```

- `ts` — миллисекунды epoch. `source` — `console` (перехват) или имя источника.
- Если `level` не `all`, возвращать ТОЛЬКО записи с `entry.level === level`
  (для `warn` — `warn|error`, для `error` — только `error`).

### 2) `GET /api/admin/diagnostics/requests?minutes=60`

- `minutes`: окно статистики, 5..1440, по умолчанию 60.
- Ответ:

```json
{
  "ok": true,
  "stats": {
    "total": 1250,
    "byStatus": { "2xx": 1190, "3xx": 10, "4xx": 40, "5xx": 10 },
    "avgMs": 84,
    "p95Ms": 312,
    "slowest": [
      { "method": "GET", "path": "/api/admin/orders", "status": 200, "ms": 5811, "ts": 1750000000000 }
    ],
    "errorsLastHour": 3
  }
}
```

- `byStatus` — всегда все четыре ключа (можно с нулями).
- `p95Ms` — 95-й перцентиль длительности запросов в окне (округлить до целого).
- `slowest` — топ-10 самых медленных запросов в окне, по убыванию `ms`.
- `errorsLastHour` — число записей уровня `error` за последние 60 минут.
- Если в окне нет запросов — вернуть `{ total: 0, byStatus: все нули, avgMs: 0, p95Ms: 0, slowest: [], errorsLastHour: <посчитанное> }`.

### 3) `GET /api/admin/diagnostics/cache`

- Ответ:

```json
{
  "ok": true,
  "cache": {
    "products":      { "size": 148, "ttlSec": 300, "ageSec": 12 },
    "pageSettings":  { "size": 5, "ttlSec": 120, "ageSec": 40 },
    "ratings":       { "size": 148 },
    "reviews":       { "size": 60 },
    "coPurchase":    { "size": 148 }
  }
}
```

- `ageSec` — сколько секунд назад кэш последний раз заполнялся (для Map —
  время последней записи; можно хранить `lastWarmedAt` рядом). Если неизвестно — `null`.

## Как сделать (по шагам)

### Шаг 1. Новый файл `server/log-buffer.ts`

Кольцевые буферы в памяти + экспорты:

```ts
// Кольцевые буферы диагностики (в памяти, очищаются при рестарте процесса).

export interface RequestLogEntry {
  ts: number;          // epoch ms
  method: string;
  path: string;
  status: number;
  ms: number;
}

export interface ErrorLogEntry {
  ts: number;          // epoch ms
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

const MAX_REQUESTS = 1000;
const MAX_ERRORS = 200;

const requestLog: RequestLogEntry[] = [];
const errorLog: ErrorLogEntry[] = [];

function push<T>(arr: T[], entry: T, max: number) {
  arr.push(entry);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export function pushRequest(entry: RequestLogEntry) {
  push(requestLog, entry, MAX_REQUESTS);
}

export function pushError(entry: Omit<ErrorLogEntry, "ts" | "level"> & { level?: ErrorLogEntry["level"] }) {
  push(errorLog, { ts: Date.now(), level: entry.level ?? "error", ...entry }, MAX_ERRORS);
}

export function getRecentErrors(limit = 100) {
  return errorLog.slice(-limit).reverse();
}

export function getRequestStats(minutes: number) {
  const since = Date.now() - minutes * 60_000;
  const inWindow = requestLog.filter((e) => e.ts >= since);

  const byStatus = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 } as Record<string, number>;
  for (const e of inWindow) {
    const bucket = e.status >= 500 ? "5xx" : e.status >= 400 ? "4xx" : e.status >= 300 ? "3xx" : "2xx";
    byStatus[bucket]++;
  }

  const msArr = inWindow.map((e) => e.ms).sort((a, b) => a - b);
  const avgMs = msArr.length ? Math.round(msArr.reduce((a, b) => a + b, 0) / msArr.length) : 0;
  const p95Ms = msArr.length ? msArr[Math.min(msArr.length - 1, Math.floor(msArr.length * 0.95))] : 0;

  const slowest = [...inWindow].sort((a, b) => b.ms - a.ms).slice(0, 10);

  const errorsSince = Date.now() - 60 * 60_000;
  const errorsLastHour = errorLog.filter((e) => e.level === "error" && e.ts >= errorsSince).length;

  return { total: inWindow.length, byStatus, avgMs, p95Ms, slowest, errorsLastHour };
}
```

### Шаг 2. Вписать сбор в `server/index.ts`

1. **Запросы** — в middleware логирования запросов (внутри `res.on("finish", ...)`),
   рядом с `log(logLine)`:

   ```ts
   import { pushRequest } from "./log-buffer";
   // внутри res.on("finish", ...) после log(logLine):
   pushRequest({ ts: Date.now(), method: req.method, path, status: res.statusCode, ms: duration });
   ```

2. **Ошибки** — один раз при старте, до `process.on(...)`-обработчиков (например,
   сразу после `import`-ов в `server/index.ts`):

   ```ts
   import { pushError } from "./log-buffer";
   const originalConsoleError = console.error;
   console.error = (...args: unknown[]) => {
     originalConsoleError(...args);
     try {
       const message = args.map(String).join(" ").slice(0, 500);
       pushError({ level: "error", source: "console", message });
     } catch { /* не ронять приложение */ }
   };
   ```

   Это перехватит все существующие `console.error(...)` без правки каждого места:
   unhandled rejection, YDB-реконнект, warmup, легальные документы, ошибки агента.

### Шаг 3. Метод `getCacheStats()` в `server/storage.ts`

Добавить метод на класс `DatabaseStorage` (или рядом с кэшами), который отдаёт:

```ts
getCacheStats(): Record<string, { size: number; ttlSec?: number; ageSec: number | null }> {
  return {
    products:     { size: productsCache.size ?? 0, ttlSec: 300, ageSec: productsCache.ageSec ?? null },
    pageSettings: { size: pageSettingsCache.size ?? 0, ttlSec: 120, ageSec: pageSettingsCache.ageSec ?? null },
    ratings:      { size: ratingsCache.size },
    reviews:      { size: reviewsCache.size },
    coPurchase:   { size: coPurchaseIndex.size ?? 0 },
  };
}
```

Подсказка: у `SimpleCache` можно добавить два геттера — `size` (количество ключей
в `this.cache`) и `ageSec` (возраст самой свежей записи: `Date.now() - max(entry.expires - ttl*1000)`),
либо хранить `lastWarmedAt` при записи. `ratingsCache`/`reviewsCache` — обычные `Map`,
у них `.size` уже есть. Co-purchase индекс — назовите по факту переменной в
`server/index.ts` (пробейте `grep -n "coPurchase" server/index.ts`).

### Шаг 4. Эндпоинты в `server/routes.ts`

Внутри `registerRoutes(...)`, рядом с другими `/api/admin/*` маршрутами, с **той же**
проверкой админ-ключа (паттерн `x-api-key` === `getAdminKey()`, как в
`GET /api/admin/users`; без ключа — `401 { error: "..." }`):

```ts
app.get("/api/admin/diagnostics/logs", async (req, res) => {
  if (!isValidAdminKey(req.headers["x-api-key"] as string)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const level = String(req.query.level ?? "error");
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100) || 100));
  const logs = getRecentErrors(limit).filter((e) =>
    level === "all" ? true : level === "warn" ? e.level !== "info" : e.level === level,
  );
  res.json({ ok: true, logs });
});

app.get("/api/admin/diagnostics/requests", async (req, res) => {
  if (!isValidAdminKey(req.headers["x-api-key"] as string)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const minutes = Math.min(1440, Math.max(5, Number(req.query.minutes ?? 60) || 60));
  res.json({ ok: true, stats: getRequestStats(minutes) });
});

app.get("/api/admin/diagnostics/cache", async (req, res) => {
  if (!isValidAdminKey(req.headers["x-api-key"] as string)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ ok: true, cache: storage.getCacheStats() });
});
```

Импорты: `getRecentErrors`, `getRequestStats` из `./log-buffer`; `storage` в
`routes.ts` уже импортирован (проверьте `grep -n "import { storage }" server/routes.ts`).

## Шаги проверки (после деплоя сайта)

1. `curl -H "x-api-key: $ADMIN_API_KEY" "https://booomerangs.ru/api/admin/diagnostics/logs?level=error&limit=10"`
   → `200`, `{ ok: true, logs: [...] }`. Пока ошибок нет — `logs: []`.
2. `curl -H "x-api-key: $ADMIN_API_KEY" "https://booomerangs.ru/api/admin/diagnostics/requests?minutes=60"`
   → `200`, в `stats` ненулевые `total` и `byStatus.2xx` (после пары запросов к сайту).
3. `curl -H "x-api-key: $ADMIN_API_KEY" "https://booomerangs.ru/api/admin/diagnostics/cache"`
   → `200`, `cache.products.size > 0`.
4. Без заголовка `x-api-key` все три → `401`.
5. Помучить сервер запросом на несуществующий путь (`/api/definitely-not-exists`)
   → в `logs?level=error` и `stats.byStatus["4xx"]` он должен появиться.

## Что НЕ входит в это ТЗ

- **Правки в приложении AdminBMG.** Вкладка «Диагностика» будет расширена
  (блоки «Журнал сервера», «Запросы», «Кэш») отдельной задачей в репозитории
  приложения — после того, как эти эндпоинты задеплоены. Контракты выше уже
  согласованы с приложением.
- **Хранение истории в YDB/БД** — не нужно, буфер в памяти достаточен.
- **Логирование тел запросов/ответов целиком** — только существующий срез до 200
  символов в `logLine`; в буфер ошибок класть сообщение до 500 символов.

# ТЗ №4 для агента репозитория BMGBRAND — эндпоинт `/healthz`

> Документ подготовлен агентом приложения **AdminBMG** для агента, работающего
> с репозиторием сайта `https://github.com/misha4323223/BMGBRAND`.
> Все изменения — ТОЛЬКО на сервере сайта.

## Зачем

В приложении AdminBMG есть раздел «Диагностика». Он проверяет живость сервера
по `GET /api/healthz` (без `/api` — см. ниже) и отклик ключевых API. Сейчас у сайта
**нет такого эндпоинта совсем** — проверка возвращает HTTP 404 и в диагностике висит
«Сервер (/healthz) — Эндпоинт недоступен (404) / Пропущено».

Нужно добавить на сервер сайта эндпоинт `/healthz`, который быстро отвечает JSON
о состоянии процесса и БД. Контракт ответа уже жёстко прописан в приложении
(`lib/diagnostics.ts`, функция `checkServerHealth`) — сервер должен вернуть ровно
эту форму, иначе диагностика не «позеленеет».

## Контракт ответа, который ждёт приложение

Приложение (`lib/diagnostics.ts`) считает сервер «живым», если:

1. Статус ответа **200** и тело — **JSON-объект** (НЕ строка и НЕ HTML). Любая HTML/SPA-заглушка → «skipped».
2. Если `data.db === true` **или** `data.database === true` **или** `data.ok === true` → статус `ok` («БД отвечает»).
3. Опционально читает и красиво показывает:
   - `uptime` (число, секунды) → «uptime N мин»
   - `memory.heapUsed` (байты) → «память ~N МБ»

Пример ожидаемого тела:

```json
{
  "ok": true,
  "db": true,
  "uptime": 1234567,
  "memory": { "heapUsed": 52428800 }
}
```

- При живом сервере, но упавшем/недоступном соединении с БД — статус должен быть
  `warn` (`db: false`), а не 500: ответ всё равно должен успеть вернуться.
- Если сервер реально лежит / таймаут / сеть — тогда, конечно, 4xx/5xx/таймаут.

## Куда и как добавить

**Файл:** `server/routes.ts`, внутри `registerRoutes(...)` (как обычные серверные
маршруты, рядом с `/robots.txt` и `/sitemap*.xml` — то есть **на уровне корневого
пути, без префикса `/api`**).

**ВАЖНО про SPA-catch-all:** в `server/index.ts` после регистрации маршрутов стоит
`botSsrMiddleware` и catch-all, который отдаёт SPA/HTML для неизвестных путей.
Проверка `app.get("/healthz")` должна быть зарегистрирована **внутри
`registerRoutes`** (как и `/robots.txt`), т.е. до catch-all — тогда Express
обработает `/healthz` вручную и не даст ему упасть в HTML-заглушку.

**Импорт БД:** в `server/routes.ts` уже есть `import { waitForDriver } from "./db";`
(строка 45) — используйте его. Сам драйвер и метод `safeQuery` лежат в
`server/db.ts` (`driver.tableClient.withSession`).

### Готовый код для вставки

В `server/routes.ts`, сразу после обработчика `/sitemap.xml` (или рядом с
`/robots.txt`), добавить:

```ts
// Health check /liveness: быстрое состояние процесса и БД.
// Возвращает JSON — диагностика приложения AdminBMG (lib/diagnostics.ts)
// полагается на ровно эту форму ответа. Должен отвечать быстро (< 500 мс).
app.get("/healthz", async (_req, res) => {
  const started = Date.now();
  let dbOk = false;
  try {
    const ydbDriver = await waitForDriver();
    if (ydbDriver) {
      await ydbDriver.tableClient.withSession(async (session) => {
        const { resultSets } = await session.executeQuery("SELECT 1 AS one;");
        const rows = resultSets[0]?.rows ?? [];
        dbOk = Array.isArray(rows) && rows.length > 0;
      });
    }
  } catch (e) {
    console.error("[healthz] DB check failed:", (e as Error)?.message || e);
    dbOk = false;
  }

  const mem = process.memoryUsage();
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    db: dbOk,
    uptime: Math.round(process.uptime()),
    memory: { heapUsed: mem.heapUsed },
    ms: Date.now() - started,
  });
});
```

Замечания:

- Проверка DB обёрнута в try/catch и не роняет запрос: даже при упавшей БД
  `/healthz` отвечает 200 c `{ ok:true, db:false }` → приложение покажет «warn», а не «fail».
- `SELECT 1 AS one;` — дешёвый пинг соединения YDB.
- `res.set("Cache-Control", "no-store")` — чтобы CDN/прокси не кэшировали ответ.

## Шаги проверки (после деплоя сайта)

1. В браузере/curl: `GET https://booomerangs.ru/healthz` → статус `200`, тело — `{ ok:true, db:true, ... }`.
2. Открыть в приложении AdminBMG: **Диагностика → Проверить снова** →
   «Сервер (/healthz)» → статус **OK**, подпись «БД отвечает» (+ при желании uptime/память).
3. Убедиться, что `/healthz` не отдаёт HTML/SPA-страницу и не висит в catch-all.

## Что НЕ входит в это ТЗ

- Скорость `/admin/orders` (тяжёлый маршрут без лимита) — отдельная задача, не здесь.
- Любые правки в приложении AdminBMG — их здесь не требуется: `lib/diagnostics.ts`
  уже полностью готов под указанный контракт.
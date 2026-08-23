# AGENTS.md

## Контекст проекта

Это **админ-приложение** (AdminBMG) — клиент управления магазином BMGBRAND/BOOOMERANGS
(React Native / Expo, web + Android + Windows-десктоп). Оно должно повторять функциональность
веб-админки официального сайта **1-в-1**: те же разделы, те же API-эндпоинты, тот же формат данных.

## Где лежит сайт (эталон для сверки)

- **Репозиторий сайта (эталон):** `https://github.com/misha4323223/BMGBRAND`
- **Локальная рабочая копия для анализа:** `/tmp/bmgbrand`
  - структура: `client/` — фронтенд сайта (React, `client/src/pages/Admin.tsx` — веб-админка),
    `server/` — сервер (Express, `server/routes.ts` — все API-маршруты, `server/storage.ts` — данные).
- **Прод-сайт:** `https://booomerangs.ru` — API: `https://booomerangs.ru/api/...`
  (админка требует `x-api-key`). Некоторые фичи сайта могут быть новее, чем в репозитории:
  их контракт можно подсмотреть в продакшн-бандле `https://booomerangs.ru/admin` →
  `assets/Admin-*.js` (лази-чанк админки).

## Границы ответственности (ВАЖНО)

- Этот репозиторий — только **приложение** (AdminBMG). Сервер сайта из здесь НЕ редактируем.
- Если для фичи нужны изменения на сервере сайта (`server/routes.ts`, `server/admin-agent.ts` и т.д.) —
  НЕ вносить правки в `/tmp/bmgbrand`. Вместо этого оформить готовое ТЗ (файл, якоря, точный код,
  шаги проверки) для другого агента, который работает с репозиторием BMGBRAND.
- Пример такого ТЗ уже передавался: инструмент `analyze_orders` для `server/admin-agent.ts`
  (анализ продаж по названию товара). Проверить, внедрён ли он: `grep -n "analyze_orders" /tmp/bmgbrand/server/admin-agent.ts`.

## Как обновить эталонную копию

```bash
cd /tmp/bmgbrand && git pull --ff-only
```

Если копии нет — клонировать:

```bash
git clone https://github.com/misha4323223/BMGBRAND.git /tmp/bmgbrand
```

## Рабочий процесс

1. Пользователь показывает раздел/скрин веб-админки → искать реализацию в `/tmp/bmgbrand`
   (`grep` по `client/src/pages/Admin.tsx` и `server/routes.ts`).
2. Найденный API-контракт (URL, тело запроса, формат ответа) переносить в приложение
   (`app/(admin)/...`, `lib/api.ts`), не меняя формат payload.
3. Если фичи нет в репо — проверять прод-бандл админки (см. выше).
4. После правок: `bun tsc -b --noEmit`, `bun run export:web`, `git diff --check`.

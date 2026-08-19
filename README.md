# BOOOMERANGS Admin (мобильная админка)

Отдельное мобильное приложение для управления админ-панелью booomerangs.ru.
Работает поверх существующего API сайта — **бэкенд менять не нужно**.

## Стек

Тот же стек, что и у основного приложения Boomer-Social:

- **Expo SDK 54** + **React Native 0.81** + **React 19** + **TypeScript 5.9**
- **Expo Router** (файловый роутинг в `app/`)
- **axios** + **expo-secure-store** (токен и API-ключ в безопасном хранилище)
- Тёмная тема BOOOMERANGS (чёрный + оранжевый акцент)

## Вход в админку

Админка использует **двухфакторную** авторизацию сайта:

1. Email + пароль учётной записи с ролью `admin` → `POST /api/auth/mobile-login`
   (возвращает JWT-токен в теле ответа — тот же механизм, что и у Boomer-Social).
2. `x-api-key` (значение `ADMIN_API_KEY` на сервере) → `POST /api/admin/verify`.

Оба значения хранятся в `expo-secure-store` и подставляются интерсептором
(`Authorization: Bearer …` + `x-api-key: …`) во все запросы.

## Запуск

```bash
bun install
bun run web        # web-превью (react-native-web)
bun run start      # Expo dev server для нативного устройства
bun run typecheck  # tsc --noEmit
```

Для сборки нативных бинарников используется EAS Build (как у Boomer-Social),
там же настраивается RuStore / Google Play / App Store.

## Структура

- `app/` — экраны (Expo Router): `login`, `(admin)` с 17 разделами.
- `lib/api.ts` — axios-клиент и загрузка изображений.
- `lib/storage.ts` — SecureStore.
- `lib/types.ts`, `lib/format.ts`, `lib/sections.ts` — типы, форматирование, реестр разделов.
- `components/` — общий UI-кит и обёртка экрана.
- `context/AuthContext.tsx` — авторизация.

## Разделы админки

Товары · Заказы · Клиенты · Оптовики · Проблемные · Бонусы · Отзывы · Избранное ·
Предзаказы · Страницы · Партнёры · Аналитика · AI-чат · AI-вопросы · SEO ·
Безопасность · Интеграции.

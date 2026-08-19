# Десктоп-версия для Windows (Electron)

Обёртка вокруг web-сборки (`bun run export:web`). Установщик собирается **на Windows-компьютере** (electron-builder собирает `.exe` именно на Windows).

## Сборка установщика (.exe)

На Windows-машине, в корне проекта:

```bash
bun install
bun run dist:win
```

Скрипт `dist:win` сам делает всё по шагам:
1. собирает web-версию (`expo export --platform web`);
2. копирует её в `desktop/dist`;
3. ставит Electron и electron-builder (локально в `desktop/`);
4. собирает установщик.

Готовый файл появится в `desktop/release/` — файл вида `BOOOMERANGS Админка Setup 1.0.0.exe`.

## Установка на ПК

1. Скопировать `.exe` на компьютер.
2. Запустить, нажать «Установить» (установщик спросит путь и создаст ярлык на рабочем столе).
3. Войти с email + паролем + API-ключом — приложение ходит прямо в `https://booomerangs.ru/api`, отдельный сервер не нужен.

## Обновление

Каждый новый `dist:win` даёт новый `.exe` — ставится поверх старой версии (те же подпись и AppId, данные не теряются).

## Иконка (по желанию)

Положить `icon.ico` (256×256) в `desktop/build/` и добавить в `desktop/package.json` → `build.win.icon: "build/icon.ico"`, затем пересобрать.

## Запуск без установки (для проверки)

```bash
bun run export:web
bun install   # в папке desktop
bunx electron desktop
```

# Релизы и авто-обновление

Приложение само проверяет обновления через **GitHub Releases** (electron-updater, см.
`src/main/updater.ts` и `publish` в `electron-builder.yml`). Релизы публикует CI по git-тегу —
вручную ничего загружать не нужно.

## Как выпустить новую версию

1. Поднять версию в `package.json` (`"version": "2.0.1"`).
2. Закоммитить: `git commit -am "Версия 2.0.1"`.
3. Поставить тег **с той же версией** и запушить:
   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```
4. GitHub Actions (`.github/workflows/release.yml`) соберёт установщик и опубликует Release
   с `latest.yml`. Установленные у пользователей версии увидят обновление при следующем
   запуске и предложат «Перезапустить».

> Важно: версия тега (`v2.0.1`) должна совпадать с `version` в `package.json` —
> electron-updater сравнивает именно их.

## Первый (базовый) релиз

`v2.0.0` — базовая версия: обновлять пока не с чего, но именно она задаёт точку отсчёта.
Авто-обновление проявится начиная со **следующего** тега (`v2.0.1` и далее).

> ⚠️ Первый прогон CI (до правки `releaseType: release`) опубликовал `v2.0.0` как
> **черновик** (draft). Его нужно один раз опубликовать вручную:
> GitHub → **Releases** → черновик `v2.0.0` → **Publish release**. Начиная с `v2.0.1`
> релизы публикуются сразу (благодаря `releaseType: release` в `electron-builder.yml`).

## Подпись кода (опционально)

Сборка не подписана — Windows SmartScreen покажет предупреждение
(«Подробнее» → «Выполнить в любом случае»). Для production стоит купить сертификат
Code Signing и добавить его в секреты CI (`CSC_LINK` / `CSC_KEY_PASSWORD`).

## Локальная сборка без публикации

```bash
npm run build            # electron-vite build + electron-builder
# или явно без публикации:
npx electron-vite build && npx electron-builder --win --publish never
```
Установщик появится в `dist/`.

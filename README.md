# Оценка.Про — цифровое рабочее место оценщика

B2B-сервис для профессиональных оценщиков недвижимости. Первый фокус (MVP): **квартира, сравнительный подход**.

Сценарий: адрес / кадастровый номер → выписка ЕГРН → карточка объекта → аналоги с источниками →
корректировки по версионному справочнику → прозрачный расчёт → автоматические проверки → отчёт DOCX/PDF.

## Стек

- Next.js 15 (App Router) + React 19 + TypeScript, Tailwind CSS 4
- PostgreSQL + Prisma 6
- Расчёты — `decimal.js` (без float), тесты — Vitest
- Отчёты — `docx` (DOCX) и `pdfmake` (PDF, шрифты с кириллицей в `assets/fonts`)
- PWA (manifest + service worker) — установка на iPhone через Safari, основа для Android-обёртки в RuStore

## Запуск локально

```bash
cp .env.example .env          # DATABASE_URL, SESSION_SECRET
npm install
npx prisma migrate dev        # создать схему БД
npm run dev                   # http://localhost:3000
npm test                      # тесты расчётного ядра, проверок, ЕГРН, отчёта
```

Системные данные (демо-справочник корректировок, шаблон отчёта, нормативная база) создаются автоматически при первом обращении.

## Деплой (Timeweb Cloud Apps)

Автодеплой по пушу в `main`. В репозитории есть `Dockerfile`:

1. Timeweb Cloud → Apps → создать приложение из GitHub-репозитория, ветка `main`, тип — Dockerfile.
2. Создать управляемую БД PostgreSQL и задать переменные окружения приложения:
   - `DATABASE_URL` — строка подключения к PostgreSQL;
   - `SESSION_SECRET` — случайная строка ≥ 32 символов;
   - `PORT` — по умолчанию 3000.
3. При старте контейнер выполняет `prisma migrate deploy` и запускает сервер.

Сайт должен открываться по HTTPS (cookie сессии помечена `Secure` в production).

## Документация

- [docs/PLAN.md](docs/PLAN.md) — технический план MVP, что реализовано, дорожная карта.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура, сущности, принципы воспроизводимости и интеграций.

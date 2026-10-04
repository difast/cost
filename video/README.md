# Видео-обзор ЭВМО (Remotion)

Две версии одного ролика (~45 с, 30 к/с):

- `Desktop` — 1920×1080, для лендинга на компьютере → `public/landing/hero.mp4`;
- `Mobile` — 1080×1920, для телефона → `public/landing/hero-mobile.mp4`.

Сцены: заставка → адрес и карта → аналоги → корректировки → расчёт → контроль качества → отчёт → финал.
Экранные сцены — реальные кадры интерфейса на демонстрационной оценке (`public/shots`, снимаются Playwright-скриптом),
в кадре стоит пометка «Демонстрационные данные». Сцена «Адрес и карта» — анимированная иллюстрация.

Музыка — мягкий лаундж, синтезирован кодом (`music/lounge.mjs`): без сэмплов и чужих записей, прав третьих лиц нет.

```bash
cd video
npm install
npm run studio            # просмотр и правка в браузере
npm run music             # пересобрать музыку → public/music.mp3
REMOTION_BROWSER=/путь/к/chrome-headless-shell npm run render:desktop
REMOTION_BROWSER=/путь/к/chrome-headless-shell npm run render:mobile
npm run posters           # обложки из готовых роликов
```

Раскадровка и подписи — `src/timeline.ts`, сцены — `src/scenes.tsx`, общие элементы (камера, курсор, подсветка) — `src/kit.tsx`.

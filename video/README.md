# Видео-обзор для первого экрана (Remotion)

```bash
cd video
npm install
npm run studio     # редактирование в браузере
npm run render     # → ../public/landing/hero.mp4
npm run poster     # → ../public/landing/hero-poster.jpg
```

Лендинг показывает видео, когда в `src/lib/landing.ts` указан `src` (сейчас — заготовка со скриншотом интерфейса вместо обложки).
(настройка — `src/lib/landing.ts` в корне проекта). Чтобы заменить видео готовым роликом,
положите файл на место `hero.mp4`.

// Видео первого экрана. Пока ролика нет — показывается заготовка (обложка и подпись «скоро»).
// Когда ролик будет готов: положите файл в public/landing/hero.mp4 и укажите src: "/landing/hero.mp4".
// Исходник видео — проект Remotion в папке /video.
export const HERO_VIDEO: { src: string | null; poster: string; title: string } = {
  src: null,
  poster: "/landing/ui-adjustments.jpg",
  title: "Обзор рабочего места оценщика",
};

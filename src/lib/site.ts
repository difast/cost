// Бренд и публичный адрес сервиса. ЭВМО — бренд и название сервиса; юридическое лицо — см. company.ts.
export const SITE_DOMAIN = "evmo.ru";
export const SITE_NAME = "ЭВМО";
export const SITE_TAGLINE = "ЭВМО — рабочая система для оценки недвижимости";

/**
 * Абсолютный адрес для канонических URL, Open Graph, sitemap и robots.
 * В продакшене — всегда https://evmo.ru (переопределяется только явным SITE_URL);
 * при разработке — APP_URL (например, http://localhost:3000). Внутренние переходы — относительные.
 */
export const SITE_URL = (
  process.env.SITE_URL || (process.env.NODE_ENV === "production" ? `https://${SITE_DOMAIN}` : process.env.APP_URL || "http://localhost:3000")
).replace(/\/$/, "");

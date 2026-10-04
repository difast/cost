import { api, ok } from "@/server/http";
import { requireUser } from "@/server/auth";

/**
 * Ключ JavaScript API Яндекс Карт для интерактивной карты в кабинете.
 * JS API работает в браузере, поэтому ключ неизбежно виден странице — он выдаётся только
 * авторизованным пользователям и не хранится в коде. Ограничьте ключ по HTTP Referer
 * (домен сервиса) в Кабинете разработчика Яндекса. Можно задать отдельный ключ
 * YANDEX_MAPS_JS_API_KEY; если его нет — используется YANDEX_API_KEY.
 */
export const GET = api(async () => {
  await requireUser();
  const key = process.env.YANDEX_MAPS_JS_API_KEY?.trim() || process.env.YANDEX_API_KEY?.trim() || null;
  return ok({ jsApiKey: key });
});

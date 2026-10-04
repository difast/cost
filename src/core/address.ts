// Нормализованный адрес объекта: что сохраняется при выборе подсказки (ГАР или Яндекс Геокодер).

export interface AddressDetails {
  /** Источник нормализации: gar — Государственный адресный реестр, yandex — Яндекс Геокодер. */
  source: "gar" | "yandex";
  normalized: string;
  region: string | null;
  municipality: string | null;
  locality: string | null;
  district: string | null;
  street: string | null;
  house: string | null;
  /** Идентификаторы ГАР (если адрес выбран из ГАР). */
  garGuid: string | null;
  garObjectId: string | null;
  at: string;
}

/** Компоненты ответа Яндекс Геокодера → поля нормализованного адреса. */
export function detailsFromYandex(normalized: string, components: Array<{ kind: string; name: string }>, at = new Date().toISOString()): AddressDetails {
  const all = (k: string) => components.filter((c) => c.kind === k).map((c) => c.name);
  const last = (k: string) => all(k).at(-1) ?? null;
  // province встречается дважды: «Центральный федеральный округ», затем субъект РФ
  const provinces = all("province").filter((n) => !/федеральный округ/i.test(n));
  return {
    source: "yandex",
    normalized,
    region: provinces.at(-1) ?? null,
    municipality: last("area"),
    locality: last("locality"),
    district: last("district"),
    street: last("street"),
    house: last("house"),
    garGuid: null,
    garObjectId: null,
    at,
  };
}

/** Вариант подсказки адреса (общий вид для ГАР и геокодера). */
export interface AddressSuggestion {
  id: string;
  source: "gar" | "yandex";
  fullAddress: string;
  region: string | null;
  municipality: string | null;
  locality: string | null;
  district: string | null;
  street: string | null;
  house: string | null;
  guid: string | null;
  objectId: string | null;
  /** Координаты (есть у вариантов геокодера). */
  lat: number | null;
  lon: number | null;
  /** Точность геокодера: exact, number, near, street… */
  precision: string | null;
}

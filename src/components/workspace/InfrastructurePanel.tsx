"use client";

import { Icon } from "@/components/ui/Icon";
import { Badge, Notice, Panel } from "@/components/ui/kit";
import { fmtDate } from "@/core/format";
import { fmtDistance, sameCenter, type InfraCategory, type InfrastructureSnapshot } from "@/core/infrastructure";

interface Props {
  infra: InfrastructureSnapshot | null;
  /** Сохранённые координаты объекта. */
  lat: unknown;
  lon: unknown;
  busy: boolean;
  onSearch: () => void;
  /** Подставить ближайшую станцию метро в поля карточки. */
  onUseMetro: (name: string, distanceM: number) => void;
}

const mapUrl = (lat: number, lon: number) => `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`;

export function InfrastructurePanel({ infra, lat, lon, busy, onSearch, onUseMetro }: Props) {
  const hasCoords = lat !== null && lat !== undefined && lat !== "" && lon !== null && lon !== undefined && lon !== "";
  const stale = !!infra && hasCoords && !sameCenter(infra, lat, lon);
  const total = infra?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;

  return (
    <Panel
      title="Инфраструктура рядом"
      description={infra ? `Яндекс Карты · получено ${fmtDate(infra.retrievedAt)} · найдено объектов: ${total} · расстояния по прямой` : "Школы, детские сады, медицина, аптеки, магазины, транспорт и метро вокруг объекта"}
      actions={
        <button className={infra ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"} onClick={onSearch} disabled={busy || !hasCoords} title={hasCoords ? undefined : "Сначала определите координаты объекта"}>
          <Icon name={infra ? "history" : "search"} size={14} />
          {busy ? "Поиск…" : infra ? "Обновить" : "Найти инфраструктуру"}
        </button>
      }
    >
      {!hasCoords && !infra && <p className="text-[12.5px] text-muted">Определите координаты объекта по адресу в блоке «Местоположение» — затем станет доступен поиск ближайшей инфраструктуры.</p>}
      {hasCoords && !infra && !busy && <p className="text-[12.5px] text-muted">Координаты определены. Нажмите «Найти инфраструктуру», чтобы получить ближайшие объекты из Яндекс Карт. Результат сохранится в оценке и попадёт в раздел отчёта «Местоположение и окружение».</p>}
      {stale && <Notice tone="warn" className="mb-3">Координаты объекта изменились после поиска. Обновите инфраструктуру, чтобы расстояния соответствовали текущему положению объекта.</Notice>}
      {infra && (
        <div className="grid gap-3 md:grid-cols-2">
          {infra.categories.map((c) => <CategoryBlock key={c.key} c={c} onUseMetro={onUseMetro} />)}
        </div>
      )}
    </Panel>
  );

}

function CategoryBlock({ c, onUseMetro }: { c: InfraCategory; onUseMetro: Props["onUseMetro"] }) {
  return (
    <div className="min-w-0 rounded-md border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-subtle px-3 py-2">
        <span className="text-[13px] font-medium text-ink">{c.label}</span>
        {c.status === "ok" ? <span className="num text-[12px] text-muted">{c.items.length}</span> : c.status === "error" ? <Badge tone="err">Ошибка</Badge> : <span className="text-[12px] text-muted">нет</span>}
      </div>
      {c.status === "ok" ? (
        <ul className="divide-y divide-line">
          {c.items.map((i, idx) => (
            <li key={`${i.name}-${idx}`} className="flex items-start gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <a href={mapUrl(i.lat, i.lon)} target="_blank" rel="noopener noreferrer" className="block break-words text-[13px] leading-snug text-ink hover:text-brand" title="Показать на Яндекс Картах">{i.name}</a>
                {i.type && <div className="truncate text-[11.5px] text-muted">{i.type}</div>}
                {i.address && <div className="text-[11.5px] leading-snug text-muted">{i.address}</div>}
                {c.key === "metro" && idx === 0 && (
                  <button className="mt-1 text-[11.5px] font-medium text-brand hover:underline" onClick={() => onUseMetro(i.name, i.distanceM)}>Указать как ближайшее метро</button>
                )}
              </div>
              <span className="num shrink-0 whitespace-nowrap text-[12.5px] font-medium text-ink">{fmtDistance(i.distanceM)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2.5 text-[12px] text-muted">
          {c.status === "error" ? c.error ?? "Данные не получены" : c.key === "metro" ? `Станций метро в радиусе ${fmtDistance(c.radiusM)} нет` : `В радиусе ${fmtDistance(c.radiusM)} не найдено`}
        </p>
      )}
    </div>
  );
}

export { mapUrl };

"use client";

import { useState } from "react";

const VIEWS = [
  { key: "adjustments", label: "Корректировки", src: "/landing/ui-adjustments.jpg", caption: "Корректировки по каждому аналогу: значение, основание и цена после шага" },
  { key: "property", label: "Объект", src: "/landing/ui-property.jpg", caption: "Карточка объекта: поля из выписки ЕГРН помечены источником" },
  { key: "comparables", label: "Аналоги", src: "/landing/ui-comparables.jpg", caption: "Аналоги рядом с объектом оценки: отличия подсвечены" },
  { key: "calculation", label: "Расчёт", src: "/landing/ui-calculation.jpg", caption: "Цепочка расчёта, веса и статистика выборки" },
] as const;

export function BrowserFrame({ children, url = "evmo.ru/app" }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04),0_12px_40px_-12px_rgba(15,23,42,.18)]">
      <div className="flex h-9 items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3.5" aria-hidden="true">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        </div>
        <div className="mx-auto hidden w-full max-w-sm truncate rounded border border-zinc-200 bg-white px-3 py-0.5 text-center text-[11px] text-zinc-500 sm:block">{url}</div>
        <div className="w-10" />
      </div>
      {children}
    </div>
  );
}

export function ProductTour() {
  const [active, setActive] = useState<(typeof VIEWS)[number]["key"]>("adjustments");
  const view = VIEWS.find((v) => v.key === active)!;
  return (
    <div>
      <div className="mb-5 flex gap-1 overflow-x-auto sm:justify-center" role="tablist" aria-label="Экраны рабочего места">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={active === v.key}
            onClick={() => setActive(v.key)}
            className={`shrink-0 rounded-md px-4 py-2 text-[14.5px] transition ${active === v.key ? "bg-brand text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <BrowserFrame url="evmo.ru/app/assessments/2026-001">
        <div className="max-h-[440px] overflow-hidden sm:max-h-none">
        {VIEWS.map((v) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={v.key}
            src={v.src}
            alt={v.caption}
            width={2880}
            height={1800}
            loading={v.key === "adjustments" ? "eager" : "lazy"}
            className={`block h-auto w-[175%] max-w-none -ml-[29%] sm:ml-0 sm:w-full ${v.key === active ? "" : "hidden"}`}
          />
        ))}
        </div>
      </BrowserFrame>
      <p className="mt-3 text-center text-[12.5px] text-zinc-500">{view.caption}. Демонстрационная оценка.</p>
    </div>
  );
}

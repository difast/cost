"use client";

// Поле адреса с подсказками: ГАР (ФИАС), если справочник загружен, иначе — варианты Яндекс Геокодера.
// Запросы — с задержкой 350 мс после ввода и с кэшем ответов; ошибки подсказок не мешают ручному вводу.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AddressSuggestion } from "@/core/address";

interface SearchResponse { available: boolean; items: AddressSuggestion[]; sources: Array<"gar" | "yandex">; warning: string | null }

const SOURCE_LABEL = { gar: "ГАР", yandex: "Яндекс Геокодер" } as const;

export function AddressInput({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (s: AddressSuggestion) => void }) {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const typed = useRef(false);
  const cache = useRef(new Map<string, SearchResponse>());

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    const show = (r: SearchResponse) => {
      setItems(r.items);
      setWarning(r.items.length ? null : r.warning);
      setActive(-1);
      setOpen(r.items.length > 0);
    };
    const hit = cache.current.get(q.toLowerCase());
    if (hit) return show(hit);
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      api.get<SearchResponse>(`/api/address/search?q=${encodeURIComponent(q)}`)
        .then((r) => {
          cache.current.set(q.toLowerCase(), r);
          if (alive) show(r);
        })
        .catch(() => alive && setWarning("Подсказки адреса временно недоступны — адрес можно ввести вручную"))
        .finally(() => alive && setLoading(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [value]);

  const pick = (s: AddressSuggestion) => {
    typed.current = false;
    setOpen(false);
    setWarning(null);
    onPick(s);
  };

  const sources = [...new Set(items.map((i) => i.source))];

  return (
    <div className="relative">
      <input
        className="input"
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Начните вводить адрес и выберите вариант из списка"
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onFocus={() => items.length && typed.current && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(items.length - 1, a + 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
          else if (e.key === "Enter" && active >= 0) (e.preventDefault(), pick(items[active]));
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {loading && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted">поиск…</span>}
      {open && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-md border border-line bg-white py-1 shadow-lg" role="listbox">
          {items.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button type="button" className={`block w-full px-3 py-1.5 text-left text-[13px] ${i === active ? "bg-brand-soft" : "hover:bg-subtle"}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                {s.fullAddress}
                {s.source === "yandex" && s.precision && s.precision !== "exact" && <span className="ml-1.5 text-[11px] text-muted">({s.precision === "street" ? "только улица" : "неточно"})</span>}
              </button>
            </li>
          ))}
          <li className="border-t border-line px-3 pt-1.5 text-[11px] text-muted">{sources.map((s) => SOURCE_LABEL[s]).join(", ")}</li>
        </ul>
      )}
      {warning && !open && <div className="mt-1 text-[11.5px] text-muted">{warning}</div>}
    </div>
  );
}

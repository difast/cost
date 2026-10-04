"use client";

// Поле адреса с подсказками из ГАР (ФИАС). Если справочник не загружен — обычное поле ввода.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface GarHit { guid: string; fullAddress: string; locality: string | null; street: string | null; house: string | null }

export function AddressInput({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (h: GarHit) => void }) {
  const [items, setItems] = useState<GarHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const available = useRef<boolean | null>(null);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || available.current === false || value.trim().length < 3) return setItems([]);
    const t = setTimeout(() => {
      api.get<{ available: boolean; items: GarHit[] }>(`/api/address/search?q=${encodeURIComponent(value)}`)
        .then((r) => {
          available.current = r.available;
          setItems(r.items);
          setActive(-1);
          setOpen(r.items.length > 0);
        })
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  const pick = (h: GarHit) => {
    typed.current = false;
    onPick(h);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        className="input"
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(items.length - 1, a + 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
          else if (e.key === "Enter" && active >= 0) (e.preventDefault(), pick(items[active]));
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-md border border-line bg-white py-1 shadow-lg" role="listbox">
          {items.map((h, i) => (
            <li key={h.guid} role="option" aria-selected={i === active}>
              <button type="button" className={`block w-full px-3 py-1.5 text-left text-[13px] ${i === active ? "bg-brand-soft" : "hover:bg-subtle"}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                {h.fullAddress}
              </button>
            </li>
          ))}
          <li className="border-t border-line px-3 pt-1.5 text-[11px] text-muted">Государственный адресный реестр (ГАР)</li>
        </ul>
      )}
    </div>
  );
}

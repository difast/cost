"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const NAV = [
  { href: "/app", label: "Оценки", exact: true },
  { href: "/app/directory", label: "Справочник корректировок" },
  { href: "/app/normative", label: "Нормативная база" },
  { href: "/app/sources", label: "Источники данных" },
  { href: "/app/profile", label: "Профиль оценщика" },
];

export function AppNav({ email, docWarnings }: { email: string; docWarnings: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path.startsWith(n.href));
  const links = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setOpen(false)}
          className={`flex items-center justify-between rounded-md px-3 py-2 ${active(n) ? "bg-blue-50 font-medium text-brand" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {n.label}
          {n.href === "/app/profile" && docWarnings > 0 && <span className="badge bg-amber-100 text-warn">{docWarnings}</span>}
        </Link>
      ))}
    </nav>
  );
  const footer = (
    <div className="border-t border-line pt-3 text-xs text-muted">
      <div className="truncate">{email}</div>
      <button
        className="mt-1 text-brand hover:underline"
        onClick={async () => {
          await api.post("/api/auth/logout");
          location.href = "/login";
        }}
      >
        Выйти
      </button>
    </div>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-line bg-white p-3 lg:flex">
        <div>
          <Link href="/app" className="mb-4 block px-3 py-2 text-base font-semibold"><span className="text-brand">Оценка</span>.Про</Link>
          {links}
        </div>
        {footer}
      </aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-2 lg:hidden">
        <Link href="/app" className="font-semibold"><span className="text-brand">Оценка</span>.Про</Link>
        <button className="btn btn-ghost" onClick={() => setOpen(!open)} aria-label="Меню">☰</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 flex h-full w-64 flex-col justify-between bg-white p-3" onClick={(e) => e.stopPropagation()}>
            {links}
            {footer}
          </div>
        </div>
      )}
    </>
  );
}

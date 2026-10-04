"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Toaster } from "@/components/ui/kit";

const SECONDARY: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/app/directory", label: "Справочник корректировок", icon: "sliders" },
  { href: "/app/normative", label: "Нормативная база", icon: "book" },
  { href: "/app/sources", label: "Источники данных", icon: "database" },
  { href: "/app/profile", label: "Профиль оценщика", icon: "user" },
];

function Logo() {
  return (
    <Link href="/app" className="flex items-center gap-2 px-2 text-[15px] font-semibold tracking-tight text-white">
      <svg width="22" height="22" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="96" fill="#176b4d" />
        <path d="M128 300 256 168l128 132v108H292v-80h-72v80h-92z" fill="#fff" />
      </svg>
      Оценка.Про
    </Link>
  );
}

export function AppNav({ name, email, docWarnings, activeCount }: { name: string; email: string; docWarnings: number; activeCount: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const inAssessments = path === "/app" || path.startsWith("/app/assessments");
  const initials = (name || email).split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  async function logout() {
    await api.post("/api/auth/logout");
    location.href = "/login";
  }

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-3"><Logo /></div>
      <div className="px-3 pt-2">
        <Link
          href="/app"
          className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-[14px] font-medium transition ${inAssessments ? "bg-white/[.09] text-white" : "text-white/80 hover:bg-white/[.05] hover:text-white"}`}
        >
          <span className="flex items-center gap-2.5">
            <span className={`h-4 w-[3px] rounded-full ${inAssessments ? "bg-[#3fae7d]" : "bg-transparent"}`} />
            <Icon name="assessments" size={17} />
            Оценки
          </span>
          {activeCount > 0 && <span className="num rounded bg-white/10 px-1.5 text-[11.5px] text-white/80">{activeCount}</span>}
        </Link>
        <Link href="/app?new=1" className="mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 pl-[22px] text-[13px] text-white/60 hover:bg-white/[.05] hover:text-white">
          <Icon name="plus" size={15} /> Новая оценка
        </Link>
        <Link
          href="/app/analytics"
          className={`mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium transition ${path.startsWith("/app/analytics") ? "bg-white/[.09] text-white" : "text-white/80 hover:bg-white/[.05] hover:text-white"}`}
        >
          <span className={`h-4 w-[3px] rounded-full ${path.startsWith("/app/analytics") ? "bg-[#3fae7d]" : "bg-transparent"}`} />
          <Icon name="chart" size={17} />
          Аналитика
        </Link>
      </div>
      <div className="mt-5 px-3">
        <div className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-white/35">Справочная информация</div>
        <nav className="flex flex-col gap-0.5" aria-label="Разделы">
          {SECONDARY.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center justify-between rounded-md px-2.5 py-[7px] text-[13px] transition ${active ? "bg-white/[.09] text-white" : "text-white/65 hover:bg-white/[.05] hover:text-white"}`}
              >
                <span className="flex items-center gap-2.5"><Icon name={n.icon} size={15} />{n.label}</span>
                {n.href === "/app/profile" && docWarnings > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#e0a43a]" title="Проверьте документы оценщика" />}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto px-3 pb-2">
        <Link href="/" className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-white/65 transition hover:bg-white/[.05] hover:text-white">
          <Icon name="home" size={15} />На главную
        </Link>
        <Link
          href="/app/settings"
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition ${path.startsWith("/app/settings") ? "bg-white/[.09] text-white" : "text-white/65 hover:bg-white/[.05] hover:text-white"}`}
        >
          <Icon name="settings" size={15} />Настройки
        </Link>
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white">{initials || "—"}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] text-white">{name || "Профиль не заполнен"}</div>
            <div className="truncate text-[11.5px] text-white/45">{email}</div>
          </div>
          <button onClick={logout} className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white" title="Выйти" aria-label="Выйти">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 bg-graphite lg:block">{nav}</aside>
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between bg-graphite px-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <Link href="/app?new=1" className="rounded-md p-2 text-white/80 hover:bg-white/10" aria-label="Новая оценка"><Icon name="plus" size={18} /></Link>
          <button className="rounded-md p-2 text-white/80 hover:bg-white/10" onClick={() => setOpen(true)} aria-label="Открыть меню"><Icon name="menu" size={18} /></button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-graphite-2/50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-[272px] bg-graphite shadow-xl" onClick={(e) => e.stopPropagation()}>{nav}</div>
        </div>
      )}
      <Toaster />
    </>
  );
}

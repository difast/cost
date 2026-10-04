"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV = [
  ["#features", "Возможности"],
  ["#how", "Как работает"],
  ["#pricing", "Тарифы"],
  ["#normative", "Нормативная база"],
  ["#faq", "Вопросы"],
] as const;

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-semibold tracking-tight ${className}`} aria-label="Оценка.Про — на главную">
      <svg width="22" height="22" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="96" fill="#1d4ed8" />
        <path d="M128 300 256 168l128 132v108H292v-80h-72v80h-92z" fill="#fff" />
      </svg>
      <span className="text-[15px]">Оценка.Про</span>
    </Link>
  );
}

export function Header({ authed }: { authed: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Основное меню">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="text-[13.5px] text-slate-600 transition hover:text-slate-900">{label}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {authed ? (
            <Link href="/app" className="btn btn-primary">Открыть кабинет</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Войти</Link>
              <Link href="/register" className="btn btn-primary">Создать аккаунт</Link>
            </>
          )}
        </div>
        <button
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </div>
    </header>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto border-t border-slate-200 bg-white px-5 pb-8 lg:hidden">
          <nav className="flex flex-col py-2" aria-label="Мобильное меню">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="border-b border-slate-100 py-3.5 text-[15px] text-slate-800">{label}</a>
            ))}
          </nav>
          <div className="mt-4 grid gap-2">
            {authed ? (
              <Link href="/app" className="btn btn-primary py-2.5">Открыть кабинет</Link>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary py-2.5">Создать аккаунт</Link>
                <Link href="/login" className="btn btn-secondary py-2.5">Войти</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

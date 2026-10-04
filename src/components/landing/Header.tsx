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
      <svg width="26" height="26" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="96" fill="#1e6b50" />
        <path d="M128 300 256 168l128 132v108H292v-80h-72v80h-92z" fill="#fff" />
      </svg>
      <span className="text-[17px]">Оценка.Про</span>
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
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-5">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Основное меню">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="text-[15px] text-zinc-700 transition hover:text-brand">{label}</a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-5 lg:flex">
          {authed ? (
            <Link href="/app" className="btn btn-primary">Открыть кабинет</Link>
          ) : (
            <>
              <Link href="/login" className="flex items-center gap-2 text-[15px] text-zinc-700 hover:text-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
                Войти
              </Link>
              <Link href="/register" className="btn btn-primary px-4 py-2 text-[15px]">Создать аккаунт</Link>
            </>
          )}
        </div>
        <button
          className="-mr-2 ml-auto flex h-10 w-10 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 lg:hidden"
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
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-zinc-200 bg-white px-5 pb-8 lg:hidden">
          <nav className="flex flex-col py-2" aria-label="Мобильное меню">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="border-b border-zinc-100 py-3.5 text-[15px] text-zinc-800">{label}</a>
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

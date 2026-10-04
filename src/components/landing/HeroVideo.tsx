"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO } from "@/lib/landing";

type Mode = "desktop" | "mobile";

/**
 * Видео-обзор: на компьютере — горизонтальный ролик в рамке монитора, на телефоне — вертикальный.
 * Загружается только одна версия. Воспроизводится автоматически без звука (так требуют браузеры),
 * звук включается кнопкой. При «уменьшении движения» в системе автозапуска нет — по кнопке.
 */
export function HeroVideo() {
  const { src, poster, srcMobile, posterMobile, title } = HERO_VIDEO;
  const ref = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [reduced, setReduced] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const big = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setMode(mq.matches ? "mobile" : "desktop");
    upd();
    setReduced(rm.matches);
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  // окно с увеличенным видео: продолжает с того же места, со звуком (открыто нажатием — браузер разрешает звук)
  const open = () => {
    ref.current?.pause();
    setExpanded(true);
  };
  const close = () => {
    const t = big.current?.currentTime;
    setExpanded(false);
    const v = ref.current;
    if (v) {
      if (t !== undefined) v.currentTime = t;
      if (!reduced) v.play().catch(() => undefined);
    }
  };
  useEffect(() => {
    if (!expanded) return;
    const v = big.current;
    if (v) {
      v.currentTime = ref.current?.currentTime ?? 0;
      v.muted = false;
      v.play().catch(() => { v.muted = true; v.play().catch(() => undefined); });
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const mobile = mode === "mobile";
  const autoplay = mode !== null && !reduced;
  const play = () => {
    setStarted(true);
    const v = ref.current;
    if (v) v.play().catch(() => undefined);
  };
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().catch(() => undefined);
  };

  const video = mode && (
    <video
      key={mode}
      ref={ref}
      src={mobile ? srcMobile : src}
      poster={mobile ? posterMobile : poster}
      muted
      loop
      playsInline
      autoPlay={autoplay}
      preload={autoplay ? "auto" : "none"}
      onPlay={() => setStarted(true)}
      className="h-full w-full object-cover"
      aria-label={title}
    />
  );

  const controls = (
    <>
      {!started && !autoplay && mode && (
        <button type="button" onClick={play} className="group absolute inset-0 flex items-center justify-center" aria-label={`Смотреть видео: ${title}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-8 ring-white/40 transition group-hover:scale-105 sm:h-20 sm:w-20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
          </span>
        </button>
      )}
      {mode && (
        <button
          type="button"
          onClick={open}
          className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12.5px] font-medium text-white backdrop-blur transition hover:bg-black/75"
          aria-label="Развернуть видео"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          Развернуть
        </button>
      )}
      {mode && (
        <button
          type="button"
          onClick={toggleSound}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12.5px] font-medium text-white backdrop-blur transition hover:bg-black/75"
          aria-label={muted ? "Включить звук" : "Выключить звук"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
            {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
          </svg>
          {muted ? "Со звуком" : "Без звука"}
        </button>
      )}
    </>
  );


  const modal = expanded && mode && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={title} onClick={close}>
      <div className={`relative w-full ${mobile ? "max-w-[min(420px,calc((100vh-6rem)*9/16))]" : "max-w-[min(1100px,calc((100vh-8rem)*16/9))]"}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={close} className="absolute -top-11 right-0 flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-medium text-white transition hover:bg-white/25" aria-label="Закрыть видео">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          Закрыть
        </button>
        <div className={`overflow-hidden bg-black shadow-2xl ring-1 ring-white/10 ${mobile ? "aspect-[9/16] rounded-[22px]" : "aspect-video rounded-xl"}`}>
          <video ref={big} src={mobile ? srcMobile : src} poster={mobile ? posterMobile : poster} controls playsInline loop className="h-full w-full" aria-label={title} />
        </div>
      </div>
    </div>
  );

  if (mobile) {
    return (
      <figure className="relative mx-auto w-full max-w-[300px]">
        <div className="rounded-[38px] bg-zinc-900 p-[9px] ring-1 ring-white/15 shadow-[0_30px_60px_-25px_rgba(2,6,23,.55)]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[30px] bg-zinc-900">
            {video}
            {controls}
          </div>
        </div>
        <figcaption className="sr-only">{title}</figcaption>
        {modal}
      </figure>
    );
  }

  return (
    <figure className="relative mx-auto w-full max-w-[640px]">
      <div className="rounded-[14px] bg-zinc-900 p-[7px] ring-1 ring-white/15 shadow-[0_30px_60px_-25px_rgba(2,6,23,.55)] sm:p-[9px]">
        <div className="relative aspect-video overflow-hidden rounded-[8px] bg-zinc-900">
          {video ?? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" width={1920} height={1080} className="h-full w-full object-cover" />
          )}
          {controls}
        </div>
      </div>
      <div className="mx-auto h-5 w-24 bg-gradient-to-b from-zinc-700 to-zinc-800 sm:h-7 sm:w-32" aria-hidden="true" />
      <div className="mx-auto h-2 w-44 rounded-t-md bg-zinc-800 sm:w-56" aria-hidden="true" />
      <figcaption className="sr-only">{title}</figcaption>
      {modal}
    </figure>
  );
}

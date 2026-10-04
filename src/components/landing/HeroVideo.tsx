"use client";

import { useRef, useState } from "react";
import { HERO_VIDEO } from "@/lib/landing";

/** Видео-обзор в рамке монитора. До нажатия показывается обложка — ролик не грузится заранее. */
export function HeroVideo() {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const { src, poster, title } = HERO_VIDEO;

  return (
    <figure className="relative mx-auto w-full max-w-[640px]">
      <div className="rounded-[14px] bg-zinc-900 p-[7px] shadow-[0_30px_60px_-25px_rgba(2,6,23,.55)] sm:p-[9px]">
        <div className="relative aspect-video overflow-hidden rounded-[8px] bg-zinc-100">
          {playing && src ? (
            <video ref={ref} src={src} poster={poster} controls autoPlay playsInline className="h-full w-full object-cover" aria-label={title} />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster} alt={`${title}: кадр из видео`} width={1920} height={1080} className="h-full w-full object-cover object-left-top" />
              {src ? (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="group absolute inset-0 flex items-center justify-center"
                  aria-label={`Смотреть видео: ${title}`}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-8 ring-white/40 transition group-hover:scale-105 sm:h-20 sm:w-20">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
                  </span>
                </button>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900/10">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/90 text-white ring-8 ring-white/40 sm:h-20 sm:w-20" aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
                  </span>
                  <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-[12.5px] text-white">Видео-обзор скоро</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mx-auto h-5 w-24 bg-gradient-to-b from-zinc-700 to-zinc-800 sm:h-7 sm:w-32" aria-hidden="true" />
      <div className="mx-auto h-2 w-44 rounded-t-md bg-zinc-800 sm:w-56" aria-hidden="true" />
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

"use client";

import { useState } from "react";

/** Поле пароля с кнопкой «показать / скрыть». */
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${props.className ?? "input"} pr-11`} />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted transition hover:text-ink"
        aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={shown}
        title={shown ? "Скрыть пароль" : "Показать пароль"}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

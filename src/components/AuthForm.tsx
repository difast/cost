"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/auth/${mode}`, mode === "register" ? { email, password, name } : { email, password });
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/app") ? next : mode === "register" ? "/app/profile?welcome=1" : "/app";
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7 shadow-[0_12px_40px_-20px_rgba(17,19,18,.25)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink"><BrandMark size={26} />ЭВМО</Link>
          <h1 className="mt-1 text-xl font-semibold">{mode === "login" ? "Вход" : "Регистрация оценщика"}</h1>
        </div>
        {mode === "register" && (
          <div>
            <label className="label">ФИО</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label">Пароль{mode === "register" && " (не менее 8 символов)"}</label>
          <input className="input" type="password" required minLength={mode === "register" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {error && <div className="rounded-md border border-err/25 bg-err-soft px-3 py-2 text-[13px] text-err" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg w-full" disabled={busy}>{busy ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}</button>
        <p className="text-center text-xs text-muted">
          {mode === "login" ? (
            <>Нет аккаунта? <Link className="text-brand hover:underline" href="/register">Зарегистрироваться</Link></>
          ) : (
            <>Уже есть аккаунт? <Link className="text-brand hover:underline" href="/login">Войти</Link></>
          )}
        </p>
      </form>
    </div>
  );
}

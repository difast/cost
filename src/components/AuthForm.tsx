"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";
import { PLANS, TRIAL_DAYS, isPlanCode, type PlanCode } from "@/core/billing";

const TRIAL_PLANS: PlanCode[] = ["basic", "pro", "team"];
const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, "");
interface InviteInfo { email: string; workspace: string; roleLabel: string; status: string }

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanCode>("basic");
  const [invite, setInvite] = useState<{ token: string; info: InviteInfo | null; error?: string } | null>(null);

  useEffect(() => {
    if (mode !== "register") return;
    const q = new URLSearchParams(location.search);
    const p = q.get("plan");
    if (isPlanCode(p) && TRIAL_PLANS.includes(p)) setPlan(p);
    const token = q.get("invite");
    if (token) {
      setInvite({ token, info: null });
      api.get<InviteInfo>(`/api/invitations/${encodeURIComponent(token)}`)
        .then((info) => { setInvite({ token, info }); setEmail(info.email); })
        .catch((e) => setInvite({ token, info: null, error: errorText(e) }));
    }
  }, [mode]);
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/auth/${mode}`, mode === "register" ? { email, password, name, ...(invite ? { invite: invite.token } : { plan }) } : { email, password });
      const next = new URLSearchParams(location.search).get("next");
      // по приглашению — сразу в кабинет (приглашение принято при регистрации)
      location.href = mode === "register" && invite ? "/app" : next && (next.startsWith("/app") || next.startsWith("/invite/")) ? next : mode === "register" ? "/app/profile?welcome=1" : "/app";
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
        {mode === "register" && (invite ? (
          <div className={`rounded-md border px-3 py-2.5 text-[13px] leading-snug ${invite.error ? "border-err/25 bg-err-soft text-err" : "border-brand/25 bg-brand-soft text-ink"}`}>
            {invite.error ?? (invite.info ? <>Приглашение в рабочее пространство <b>«{invite.info.workspace}»</b> ({invite.info.roleLabel.toLowerCase()}). Зарегистрируйтесь с адресом {invite.info.email}.</> : "Проверяем приглашение…")}
          </div>
        ) : (
          <div className="rounded-md border border-brand/25 bg-brand-soft px-3 py-2.5 text-[13px] leading-snug text-ink">
            <b>7 дней бесплатно</b> на тарифе{" "}
            <select aria-label="Тариф пробного периода" className="rounded border border-brand/30 bg-white px-1 py-0.5 text-[13px] font-semibold" value={plan} onChange={(e) => setPlan(e.target.value as PlanCode)}>
              {TRIAL_PLANS.map((c) => <option key={c} value={c}>{PLANS[c].name}</option>)}
            </select>. Пробный период — до {fmt(trialEnd)}. Данные сохраняются и после него. <Link href="/pricing" className="text-brand underline-offset-2 hover:underline">Тарифы</Link>
          </div>
        ))}
        {mode === "register" && (
          <div>
            <label className="label">ФИО</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" readOnly={!!invite?.info} />
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

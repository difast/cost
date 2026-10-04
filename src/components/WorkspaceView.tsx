"use client";

// «Тариф и команда»: тариф и оплата, участники и приглашения, рабочее пространство.
// Все ограничения проверяются сервером; интерфейс только показывает их и сообщения сервера.

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, errorText } from "@/lib/api";
import { CONTACT_EMAIL, PLANS, PLAN_ORDER, formatPrice, type PlanCode } from "@/core/billing";
import { fmtDate } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, ConfirmModal, Notice, Panel, toast, type Tone } from "@/components/ui/kit";

interface Summary {
  workspace: { id: string; name: string };
  role: string;
  roleLabel: string;
  plan: { code: PlanCode; name: string; priceRub: number; priceFrom: boolean; maxMembers: number | null };
  members: number;
  pendingInvites: number;
  membersLabel: string;
  state: "trial_active" | "trial_expired" | "active" | "expired";
  stateLabel: string;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  paymentStatus: string;
  permissions: { manageBilling: boolean; manageMembers: boolean; assignAdmin: boolean };
  workspaces: Array<{ id: string; name: string; role: string; current: boolean }>;
}
interface Member { id: string; name: string; email: string; role: string; roleLabel: string; statusLabel: string; createdAt: string; you: boolean }
interface Invite { id: string; email: string; role: string; roleLabel: string; status: string; statusLabel: string; createdAt: string; expiresAt: string }

const STATE_TONE: Record<Summary["state"], Tone> = { trial_active: "brand", active: "ok", trial_expired: "warn", expired: "err" };
const PAYMENT_LABEL: Record<string, string> = { none: "Онлайн-оплата пока не подключена", pending: "Ожидает оплаты", paid: "Оплачено", failed: "Ошибка оплаты" };
const mailto = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export function WorkspaceView() {
  const [s, setS] = useState<Summary | null>(null);
  const [m, setM] = useState<{ members: Member[]; invitations: Invite[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get<Summary>("/api/workspace"), api.get<{ members: Member[]; invitations: Invite[] }>("/api/workspace/members")]);
      setS(a);
      setM(b);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <Notice tone="err" title="Не удалось загрузить">{error}</Notice>;
  if (!s || !m) return <div className="card h-64 animate-pulse" />;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Тариф и команда</h1>
        <p className="mt-1 text-[13.5px] text-muted">Рабочее пространство «{s.workspace.name}» · ваша роль: {s.roleLabel}</p>
      </div>
      <BillingPanel s={s} reload={load} />
      <MembersPanel s={s} m={m} reload={load} />
      <WorkspacePanel s={s} reload={load} />
    </div>
  );
}

function BillingPanel({ s, reload }: { s: Summary; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const paid = s.state === "trial_active" || s.state === "active";
  async function choose(code: PlanCode) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post<{ paymentRequired: boolean }>("/api/workspace/plan", { plan: code });
      setMsg(r.paymentRequired
        ? { tone: "info", text: `Тариф «${PLANS[code].name}» выбран. Онлайн-оплата пока подключается — напишите на ${CONTACT_EMAIL}, и мы откроем доступ.` }
        : { tone: "ok", text: `Тариф изменён на «${PLANS[code].name}».` });
      await reload();
    } catch (e) {
      setMsg({ tone: "err", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Тариф и оплата">
      {!paid && (
        <Notice tone="warn" className="mb-4" title={s.state === "trial_expired" ? "Пробный период закончился" : "Подписка закончилась"}
          action={<a className="btn btn-primary btn-sm" href={mailto(`Оплата тарифа ЭВМО: ${s.plan.name}`)}>Связаться для оплаты</a>}>
          Все данные сохранены: оценки, документы и отчёты доступны для просмотра. Чтобы создавать и изменять оценки, выберите тариф.
        </Notice>
      )}
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Item k="Текущий тариф" v={<span className="text-[17px] font-semibold">{s.plan.name}</span>} />
        <Item k="Стоимость" v={formatPrice(PLANS[s.plan.code])} />
        <Item k="Статус подписки" v={<Badge tone={STATE_TONE[s.state]}>{s.stateLabel}</Badge>} />
        <Item k="Пользователи" v={<b>{s.membersLabel}</b>} />
        <Item k="Лимит пользователей" v={s.plan.maxMembers === null ? "Без ограничений" : String(s.plan.maxMembers)} />
        <Item k="Занято мест" v={`${s.members}${s.pendingInvites ? ` + приглашений: ${s.pendingInvites}` : ""}`} />
        {s.trialEndsAt && (
          <Item
            k="Пробный период"
            v={<>до {fmtDate(s.trialEndsAt)}{s.state === "trial_active" && s.trialDaysLeft !== null ? <span className="text-muted"> · осталось дней: {s.trialDaysLeft}</span> : null}</>}
          />
        )}
        {s.currentPeriodEnd && <Item k="Оплачено до" v={fmtDate(s.currentPeriodEnd)} />}
        <Item k="Оплата" v={PAYMENT_LABEL[s.paymentStatus] ?? s.paymentStatus} />
      </dl>

      {s.permissions.manageBilling ? (
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 text-[13px] font-medium text-ink">Сменить тариф</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((c) => {
              const p = PLANS[c];
              const current = c === s.plan.code;
              return (
                <div key={c} className={`rounded-md border px-3 py-2.5 ${current ? "border-brand bg-brand-soft/40" : "border-line"}`}>
                  <div className="text-[13.5px] font-semibold">{p.name}</div>
                  <div className="text-[12.5px] text-muted">{formatPrice(p)} · {p.maxMembers === null ? "без ограничений" : p.maxMembers === 1 ? "1 пользователь" : `до ${p.maxMembers} пользователей`}</div>
                  {current ? (
                    <div className="mt-2 text-[12.5px] font-medium text-brand">Текущий тариф</div>
                  ) : p.selfServe ? (
                    <button className="btn btn-secondary btn-sm mt-2 w-full" disabled={busy} onClick={() => choose(c)}>Выбрать</button>
                  ) : (
                    <a className="btn btn-secondary btn-sm mt-2 w-full" href={mailto("Корпоративный тариф ЭВМО")}>Связаться</a>
                  )}
                </div>
              );
            })}
          </div>
          {msg && <Notice tone={msg.tone} className="mt-3">{msg.text}</Notice>}
          <p className="mt-3 text-[12px] text-muted">Во время пробного периода тариф меняется сразу. Вопросы об оплате — <a className="text-brand hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] text-muted">Тариф может изменить владелец рабочего пространства.</p>
      )}
    </Panel>
  );
}

function MembersPanel({ s, m, reload }: { s: Summary; m: { members: Member[]; invitations: Invite[] }; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<{ message: string; upgrade: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const atLimit = s.plan.maxMembers !== null && s.members + s.pendingInvites >= s.plan.maxMembers;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setLimit(null);
    try {
      const r = await api.post<{ email: string; link: string; emailSent: boolean }>("/api/workspace/invitations", { email, role });
      setSent(r);
      setEmail("");
      setOpen(false);
      await reload();
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 402) {
        const d = e2.details as { upgrade?: string } | undefined;
        setLimit({ message: e2.message, upgrade: d?.upgrade ?? null });
      } else setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }
  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast(done);
      await reload();
    } catch (e) {
      toast(errorText(e), "err");
    }
  };

  const limitNotice = (message: string, upgrade: string | null) => (
    <Notice tone="warn" className="mt-3" action={upgrade === "corporate" ? <a className="btn btn-secondary btn-sm" href={mailto("Корпоративный тариф ЭВМО")}>Связаться по поводу корпоративного тарифа</a> : undefined}>
      {message}
    </Notice>
  );

  return (
    <Panel
      title="Участники"
      description={s.membersLabel}
      actions={s.permissions.manageMembers && (
        <button className="btn btn-primary btn-sm" onClick={() => { setOpen(!open); setLimit(null); setErr(null); }}><Icon name="plus" size={14} />Пригласить участника</button>
      )}
      bodyClassName=""
    >
      {open && (
        <form onSubmit={invite} className="border-b border-line bg-canvas/60 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input sm:max-w-sm" type="email" required placeholder="email сотрудника" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email участника" />
            <select className="input sm:w-48" value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} aria-label="Роль">
              <option value="member">Участник</option>
              {s.permissions.assignAdmin && <option value="admin">Администратор</option>}
            </select>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Отправка…" : "Пригласить"}</button>
          </div>
          <p className="mt-2 text-[12px] text-muted">Приглашение действует 7 дней. Участник получит отдельную учётную запись и доступ к оценкам рабочего пространства.</p>
          {err && <Notice tone="err" className="mt-2">{err}</Notice>}
          {limit && limitNotice(limit.message, limit.upgrade)}
        </form>
      )}
      {!open && atLimit && s.permissions.manageMembers && (
        <div className="px-4 pt-3">
          {s.plan.code === "team"
            ? limitNotice("В вашем тарифе доступно до 5 пользователей. Чтобы добавить больше участников, перейдите на Корпоративный тариф.", "corporate")
            : s.plan.maxMembers !== null && <Notice tone="info">В тарифе «{s.plan.name}» доступен {s.plan.maxMembers} пользователь. Для работы командой выберите тариф «Команда» (до 5 пользователей).</Notice>}
        </div>
      )}
      {sent && (
        <div className="px-4 pt-3">
          <Notice tone="ok" title={`Приглашение для ${sent.email} создано`}>
            {sent.emailSent ? "Письмо с приглашением отправлено." : "Отправка писем не настроена — передайте ссылку сотруднику:"}
            {!sent.emailSent && (
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[12px]">{sent.link}</code>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(sent.link).then(() => toast("Ссылка скопирована"))}>Копировать</button>
              </div>
            )}
          </Notice>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="tbl min-w-[720px]">
          <thead>
            <tr><th>Имя</th><th>Email</th><th>Роль</th><th>Статус</th><th>Дата добавления</th><th /></tr>
          </thead>
          <tbody>
            {m.members.map((x) => (
              <tr key={x.id}>
                <td>{x.name || "—"}{x.you && <span className="ml-1.5 text-[12px] text-muted">(вы)</span>}</td>
                <td className="[overflow-wrap:anywhere]">{x.email}</td>
                <td>
                  {s.permissions.assignAdmin && x.role !== "owner" ? (
                    <select className="input py-1 text-[13px]" value={x.role} onChange={(e) => act(() => api.patch(`/api/workspace/members/${x.id}`, { role: e.target.value }), "Роль изменена")} aria-label={`Роль ${x.email}`}>
                      <option value="member">Участник</option>
                      <option value="admin">Администратор</option>
                    </select>
                  ) : x.roleLabel}
                </td>
                <td><Badge tone="ok">{x.statusLabel}</Badge></td>
                <td>{fmtDate(x.createdAt)}</td>
                <td className="text-right">
                  {x.role !== "owner" && (x.you || (s.permissions.manageMembers && (x.role !== "admin" || s.permissions.assignAdmin))) && (
                    <button className="btn btn-ghost btn-sm text-err" onClick={() => setRemoving(x)}>{x.you ? "Выйти" : "Исключить"}</button>
                  )}
                </td>
              </tr>
            ))}
            {m.invitations.map((i) => (
              <tr key={i.id} className="text-muted">
                <td>—</td>
                <td className="[overflow-wrap:anywhere]">{i.email}</td>
                <td>{i.roleLabel}</td>
                <td><Badge tone={i.status === "expired" ? "err" : "warn"}>{i.statusLabel}</Badge></td>
                <td>{fmtDate(i.createdAt)} <span className="text-[12px]">· до {fmtDate(i.expiresAt)}</span></td>
                <td className="text-right">
                  {s.permissions.manageMembers && <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.del(`/api/workspace/invitations/${i.id}`), "Приглашение отозвано")}>Отозвать</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmModal open={!!removing} title={removing?.you ? "Выйти из рабочего пространства?" : `Исключить ${removing?.email}?`} confirmLabel={removing?.you ? "Выйти" : "Исключить"}
        onClose={() => setRemoving(null)}
        onConfirm={() => { const r = removing!; setRemoving(null); act(() => api.del(`/api/workspace/members/${r.id}`), r.you ? "Вы вышли из рабочего пространства" : "Участник исключён").then(() => { if (r.you) location.href = "/app"; }); }}>
        Оценки и документы останутся в рабочем пространстве — ничего не удаляется.
      </ConfirmModal>
    </Panel>
  );
}

function WorkspacePanel({ s, reload }: { s: Summary; reload: () => Promise<void> }) {
  const [name, setName] = useState(s.workspace.name);
  const canEdit = s.role === "owner" || s.role === "admin";
  return (
    <Panel title="Рабочее пространство">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="label">Название</span>
          <input className="input" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        </label>
        {canEdit && <button className="btn btn-secondary" disabled={name.trim() === s.workspace.name || !name.trim()} onClick={() => api.patch("/api/workspace", { name }).then(() => { toast("Название сохранено"); reload(); }).catch((e) => toast(errorText(e), "err"))}>Сохранить</button>}
      </div>
      {s.workspaces.length > 1 && (
        <div className="mt-4">
          <span className="label">Ваши рабочие пространства</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {s.workspaces.map((w) => (
              <button key={w.id} disabled={w.current} className={`btn btn-sm ${w.current ? "btn-primary" : "btn-secondary"}`} onClick={() => api.post("/api/workspace/switch", { workspaceId: w.id }).then(() => (location.href = "/app"))}>
                {w.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className="mt-0.5 text-[14px] text-ink [overflow-wrap:anywhere]">{v}</dd>
    </div>
  );
}

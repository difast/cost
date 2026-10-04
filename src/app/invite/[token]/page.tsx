import Link from "next/link";
import { currentUser } from "@/server/auth";
import { invitationInfo } from "@/server/services/team";
import { BrandMark } from "@/components/BrandMark";
import { AcceptInvite } from "./AcceptInvite";
import { fmtDate } from "@/core/format";

export const metadata = { title: "Приглашение", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [info, user] = await Promise.all([invitationInfo(token), currentUser().catch(() => null)]);
  const next = encodeURIComponent(`/invite/${token}`);
  const problem = !info ? "Приглашение не найдено — проверьте ссылку."
    : info.status === "accepted" ? "Приглашение уже принято."
    : info.status === "revoked" ? "Приглашение отозвано."
    : info.status === "expired" ? "Срок действия приглашения истёк — попросите администратора отправить новое."
    : null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="card w-full max-w-md space-y-4 p-7">
        <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink"><BrandMark size={26} />ЭВМО</Link>
        <h1 className="text-xl font-semibold">Приглашение в команду</h1>
        {problem || !info ? (
          <p className="rounded-md border border-err/25 bg-err-soft px-3 py-2 text-[13.5px] text-err">{problem}</p>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-zinc-700">
              {info.invitedBy} приглашает вас в рабочее пространство <b>«{info.workspace}»</b> с ролью «{info.roleLabel}». Приглашение для {info.email}, действует до {fmtDate(info.expiresAt)}.
            </p>
            {user ? (
              user.email.toLowerCase() === info.email.toLowerCase() ? (
                <AcceptInvite token={token} />
              ) : (
                <p className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[13.5px]">Вы вошли как {user.email}. Приглашение отправлено на {info.email} — выйдите и войдите под этим адресом.</p>
              )
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={`/register?invite=${encodeURIComponent(token)}&next=${next}`} className="btn btn-primary flex-1">Зарегистрироваться</Link>
                <Link href={`/login?next=${next}`} className="btn btn-secondary flex-1">У меня есть аккаунт</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { AppNav } from "@/components/AppNav";
import Link from "next/link";
import { getAccess } from "@/server/workspace";
import { CONTACT_EMAIL, hasPaidAccess, trialDaysLeft } from "@/core/billing";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const access = await getAccess(user);
  const [ap, activeCount] = await Promise.all([
    prisma.appraiser.findUnique({ where: { userId: user.id } }),
    prisma.assessment.count({ where: { workspaceId: access.workspace.id, status: { in: ["draft", "in_progress", "review"] } } }),
  ]);
  // Состояние подписки определяется на сервере по датам из БД
  const paid = hasPaidAccess(access.state);
  const days = trialDaysLeft(access.subscription);
  const until = access.subscription.trialEndsAt?.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const soon = Date.now() + 30 * 86_400_000;
  const docWarnings = ap
    ? [ap.qualificationCertValidUntil, ap.insuranceValidUntil, ap.legalEntityInsuranceValidUntil].filter((d) => d && d.getTime() < soon).length +
      (!ap.fullName || !ap.sroName || !ap.insurancePolicyNumber ? 1 : 0)
    : 1;
  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <AppNav name={ap?.fullName || user.name || ""} email={user.email} docWarnings={docWarnings} activeCount={activeCount} />
      <main className="min-w-0 flex-1 px-4 pb-10 pt-5 lg:px-8 lg:pt-7">
        {!paid ? (
          <div role="alert" className="mb-5 flex flex-col gap-2 rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-[13.5px] text-ink sm:flex-row sm:items-center">
            <span className="flex-1">
              <b>{access.state === "trial_expired" ? "Пробный период закончился." : "Подписка закончилась."}</b> Все данные сохранены и доступны для просмотра. Чтобы создавать и изменять оценки, выберите тариф.
            </span>
            <span className="flex shrink-0 gap-2">
              <Link href="/app/workspace" className="btn btn-primary btn-sm">Выбрать тариф</Link>
              <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-secondary btn-sm">{CONTACT_EMAIL}</a>
            </span>
          </div>
        ) : access.state === "trial_active" && days !== null ? (
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-brand/20 bg-brand-soft/60 px-4 py-2 text-[13px] text-ink">
            <span>Пробный период тарифа «{access.plan.name}» — до {until}{days <= 3 ? ` (осталось дней: ${days})` : ""}.</span>
            <Link href="/app/workspace" className="text-brand underline-offset-2 hover:underline">Тариф и команда</Link>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

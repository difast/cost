import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { AppNav } from "@/components/AppNav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [ap, activeCount] = await Promise.all([
    prisma.appraiser.findUnique({ where: { userId: user.id } }),
    prisma.assessment.count({ where: { ownerId: user.id, status: { in: ["draft", "in_progress", "review"] } } }),
  ]);
  const soon = Date.now() + 30 * 86_400_000;
  const docWarnings = ap
    ? [ap.qualificationCertValidUntil, ap.insuranceValidUntil, ap.legalEntityInsuranceValidUntil].filter((d) => d && d.getTime() < soon).length +
      (!ap.fullName || !ap.sroName || !ap.insurancePolicyNumber ? 1 : 0)
    : 1;
  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <AppNav name={ap?.fullName || user.name || ""} email={user.email} docWarnings={docWarnings} activeCount={activeCount} />
      <main className="min-w-0 flex-1 px-4 pb-10 pt-5 lg:px-8 lg:pt-7">{children}</main>
    </div>
  );
}

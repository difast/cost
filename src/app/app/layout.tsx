import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { AppNav } from "@/components/AppNav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ap = await prisma.appraiser.findUnique({ where: { userId: user.id } });
  const soon = Date.now() + 30 * 86_400_000;
  const docWarnings = ap
    ? [ap.qualificationCertValidUntil, ap.insuranceValidUntil, ap.legalEntityInsuranceValidUntil].filter((d) => d && d.getTime() < soon).length +
      (!ap.fullName || !ap.sroName || !ap.insurancePolicyNumber ? 1 : 0)
    : 1;
  return (
    <div className="lg:flex">
      <AppNav email={user.email} docWarnings={docWarnings} />
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-8">{children}</main>
    </div>
  );
}

import { Header } from "./Header";
import { Footer } from "./Footer";
import { currentUser } from "@/server/auth";
import { COMPANY } from "@/lib/company";

export async function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const authed = !!(await currentUser().catch(() => null));
  return (
    <div className="bg-zinc-50">
      <Header authed={authed} />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-2 text-[14px] text-zinc-500">Редакция от {COMPANY.documentsRevision}</p>
        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-zinc-700 [&_h2]:mt-8 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc">
          {children}
          <h2>Реквизиты и контакты</h2>
          <p>
            {COMPANY.fullName} ({COMPANY.name})<br />
            ОГРН {COMPANY.ogrn}, ИНН {COMPANY.inn}, КПП {COMPANY.kpp}<br />
            Юридический адрес: {COMPANY.address}
            {COMPANY.email && (
              <>
                <br />
                Электронная почта: <a className="text-brand underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </>
            )}
            <br />
            Время связи: {COMPANY.hours}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

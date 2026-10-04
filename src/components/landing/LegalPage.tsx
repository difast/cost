import { Header } from "./Header";
import { Footer } from "./Footer";
import { currentUser } from "@/server/auth";
import { CONTACT_EMAIL } from "@/lib/site";

export async function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const authed = !!(await currentUser().catch(() => null));
  return (
    <div className="bg-slate-50">
      <Header authed={authed} />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
          Редакция для раннего доступа. Сведения об операторе (наименование, ИНН, ОГРН, адрес) будут указаны до начала приёма платежей.
        </p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
          {children}
          <h2>Контакты</h2>
          <p>{CONTACT_EMAIL ? <>Вопросы по документу: <a className="text-brand underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</> : "Контактный адрес для обращений будет опубликован на сайте."}</p>
        </div>
      </main>
      <Footer contactEmail={CONTACT_EMAIL} />
    </div>
  );
}

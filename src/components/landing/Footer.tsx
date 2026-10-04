import Link from "next/link";
import { Logo } from "./Header";

export function Footer({ contactEmail }: { contactEmail?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,4fr)_repeat(3,minmax(0,2fr))]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-slate-500">Рабочее место оценщика недвижимости: данные объекта, аналоги, корректировки, расчёт, проверки и отчёт.</p>
        </div>
        <nav aria-label="Продукт">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Продукт</div>
          <ul className="mt-3 space-y-2 text-[13.5px] text-slate-600">
            <li><a href="/#about" className="hover:text-slate-900">О сервисе</a></li>
            <li><a href="/#features" className="hover:text-slate-900">Возможности</a></li>
            <li><a href="/#how" className="hover:text-slate-900">Как работает</a></li>
            <li><a href="/#pricing" className="hover:text-slate-900">Тарифы</a></li>
          </ul>
        </nav>
        <nav aria-label="Информация">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Информация</div>
          <ul className="mt-3 space-y-2 text-[13.5px] text-slate-600">
            <li><a href="/#normative" className="hover:text-slate-900">Нормативная база</a></li>
            <li><a href="/#faq" className="hover:text-slate-900">Вопросы</a></li>
            <li><Link href="/privacy" className="hover:text-slate-900">Политика конфиденциальности</Link></li>
            <li><Link href="/terms" className="hover:text-slate-900">Пользовательское соглашение</Link></li>
          </ul>
        </nav>
        <div id="contacts">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Контакты</div>
          <ul className="mt-3 space-y-2 text-[13.5px] text-slate-600">
            {contactEmail ? (
              <li><a href={`mailto:${contactEmail}`} className="hover:text-slate-900">{contactEmail}</a></li>
            ) : (
              <li className="text-slate-400">Контакты появятся в ближайшее время</li>
            )}
            <li><Link href="/login" className="hover:text-slate-900">Вход для оценщиков</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-[12px] text-slate-400 sm:flex-row sm:justify-between">
          <span>© {year} Оценка.Про</span>
          <span>Сервис не заменяет профессиональное суждение и ответственность оценщика.</span>
        </div>
      </div>
    </footer>
  );
}

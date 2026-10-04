import Link from "next/link";
import { PLANS } from "@/lib/plans";

/** Карточки тарифов: пользователи, возможности, отличие от соседнего тарифа. */
export function PricingCards() {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
      {PLANS.map((p) => (
        <article
          key={p.code}
          className={`flex w-[82%] shrink-0 snap-start flex-col rounded-lg border bg-white p-6 sm:w-[48%] lg:w-auto ${p.recommended ? "border-brand ring-1 ring-brand" : "border-zinc-200"}`}
        >
          <div className="flex h-5 items-center">{p.recommended && <span className="rounded bg-brand-soft px-2 py-0.5 text-[11.5px] font-medium text-brand">Основной тариф</span>}</div>
          <h3 className="mt-2 text-[16px] font-semibold text-zinc-900">{p.name}</h3>
          <p className="mt-1 text-[13px] text-zinc-500">{p.audience}</p>
          <div className="mt-5 flex items-baseline gap-1.5">
            {p.pricePrefix && <span className="text-[14px] text-zinc-500">{p.pricePrefix}</span>}
            <span className="num text-[28px] font-semibold tracking-tight text-zinc-900">{p.price} ₽</span>
            <span className="text-[13px] text-zinc-500">/ мес.</span>
          </div>
          <div
            className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-[13.5px] font-semibold ${
              p.code === "team" ? "bg-brand text-white" : p.code === "corporate" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />{p.code !== "basic" && p.code !== "pro" && <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2" />}</svg>
            {p.users}
          </div>
          <p className="mt-3 text-[12.5px] leading-snug text-zinc-500">{p.diff}</p>
          <ul className="mt-4 flex-1 space-y-2.5 text-[13.5px]">
            {p.items.map((it) => (
              <li key={it.text} className="flex gap-2.5">
                <svg className="mt-[3px] shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={it.status ? "#94a3b8" : "#1e6b50"} strokeWidth="2" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>
                <span className={it.status ? "text-zinc-500" : "text-zinc-800"}>
                  {it.text}
                  {it.status === "planned" && <span className="ml-1.5 whitespace-nowrap text-[11.5px] text-zinc-400">— в разработке</span>}
                </span>
              </li>
            ))}
          </ul>
          {p.cta.href.startsWith("mailto:") ? (
            <a href={p.cta.href} className="btn btn-secondary mt-6 py-2">{p.cta.label}</a>
          ) : (
            <Link href={p.cta.href} className={`btn mt-6 h-auto whitespace-normal py-2 text-center ${p.recommended ? "btn-primary" : "btn-secondary"}`}>{p.cta.label}</Link>
          )}
        </article>
      ))}
    </div>
  );
}

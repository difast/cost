import { listSources } from "@/server/integrations/registry";
import type { ProviderInfo } from "@/server/integrations/types";
import { Badge, PageHeader } from "@/components/ui/kit";
import { Icon } from "@/components/ui/Icon";

export const metadata = { title: "Источники данных" };

const ACCESS: Record<string, string> = { official_api: "Официальный API", partner_api: "Партнёрский API", licensed_data: "Лицензированный поставщик", user_import: "Загрузка файла оценщиком", manual: "Ручной ввод" };

function SourceRow({ s }: { s: ProviderInfo }) {
  return (
    <li className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_160px] md:items-start">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${s.configured ? "bg-brand-soft text-brand" : "bg-subtle text-muted"}`}><Icon name="database" size={16} /></span>
        <div className="min-w-0">
          <div className="font-medium text-ink">{s.name}</div>
          <div className="text-[12px] text-muted">{ACCESS[s.access]}</div>
          {s.note && <div className="mt-1 text-[12px] text-muted">{s.note}</div>}
        </div>
      </div>
      <div>
        <div className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-muted">{s.configured ? "Используется для" : "Будет использоваться для"}</div>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {(s.usedFor ?? []).map((u) => <li key={u} className="rounded border border-line bg-canvas px-1.5 py-0.5 text-[12px] text-zinc-700">{u}</li>)}
        </ul>
      </div>
      <div className="md:text-right">
        {s.configured ? <Badge tone="ok" icon="check">Доступен</Badge> : <Badge tone="neutral">Не подключён</Badge>}
      </div>
    </li>
  );
}

export default function Page() {
  const sources = listSources();
  const active = sources.filter((s) => s.configured);
  const planned = sources.filter((s) => !s.configured);
  return (
    <div className="mx-auto max-w-[1360px]">
      <PageHeader title="Источники данных" description="Откуда берутся данные оценки. У каждого значения в карточке объекта хранится источник и дата получения." />
      <section className="card mb-4">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Работают сейчас <span className="num ml-1 font-normal text-muted">{active.length}</span></h2>
        </header>
        <ul className="divide-y divide-line">{active.map((s) => <SourceRow key={s.code} s={s} />)}</ul>
      </section>
      <section className="card">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Планируемые интеграции <span className="num ml-1 font-normal text-muted">{planned.length}</span></h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Подключаются только через официальный или партнёрский доступ либо лицензированного поставщика. Парсинг сайтов не используется.</p>
        </header>
        <ul className="divide-y divide-line">{planned.map((s) => <SourceRow key={s.code} s={s} />)}</ul>
      </section>
    </div>
  );
}

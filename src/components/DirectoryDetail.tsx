"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtPercent } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, KV, Notice, PageHeader, PageSkeleton, SearchInput, Segmented, toast } from "@/components/ui/kit";
import { LICENSE } from "./DirectoryList";

interface Cat { id: string; code: string; label: string; coefficient: string; minCoefficient: string | null; maxCoefficient: string | null }
interface Factor { id: string; code: string; name: string; kind: string; attribute: string | null; stage: number; value: string | null; minValue: string | null; maxValue: string | null; params: Record<string, unknown>; reference: string | null; description: string | null; enabled: boolean; categories: Cat[] }
interface Src { id: string; name: string; edition: string; publisher: string | null; actualDate: string | null; licenseType: string; licenseNote: string | null; isDemo: boolean; isActive: boolean; editable: boolean; factors: Factor[]; _count: { assessments: number } }

const KIND: Record<string, string> = { discount: "Фиксированная скидка", category: "Коэффициенты категорий", power: "Степенная функция", manual: "Экспертная" };
const KIND_HINT: Record<string, string> = {
  discount: "Применяется ко всем аналогам",
  category: "Корректировка = k(объект) / k(аналог) − 1",
  power: "(S объекта / S аналога)^b − 1",
  manual: "Определяется оценщиком, по умолчанию 0 %",
};
const range = (min: string | null, max: string | null) => (min || max ? `${min ? fmtPercent(min, 1) : "−∞"} … ${max ? fmtPercent(max, 1) : "+∞"}` : "—");

function Values({ f }: { f: Factor }) {
  if (f.kind === "discount") return <span className="num font-medium">{f.value ? fmtPercent(f.value, 2, true) : "—"}</span>;
  if (f.kind === "power") return <span className="num">b = {String(f.params.exponent ?? "—")}</span>;
  if (f.kind === "manual") return <span className="text-muted">задаёт оценщик</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {f.categories.map((c) => (
        <span key={c.id} className="num rounded border border-line bg-canvas px-1.5 py-0.5 text-[12px]"><span className="text-muted">{c.label}</span> {c.coefficient.replace(".", ",")}</span>
      ))}
    </div>
  );
}

function Editor({ f, sid, onDone, onCancel }: { f: Factor; sid: string; onDone: () => void; onCancel: () => void }) {
  const [st, setSt] = useState({ value: f.value ?? "", minValue: f.minValue ?? "", maxValue: f.maxValue ?? "", reference: f.reference ?? "", enabled: f.enabled, exponent: String(f.params.exponent ?? ""), cats: f.categories.map((c) => ({ id: c.id, label: c.label, coefficient: c.coefficient })) });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = (v: string) => v.replace(",", ".");
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/directory/${sid}/factors/${f.id}`, {
        value: st.value ? n(st.value) : null, minValue: st.minValue ? n(st.minValue) : null, maxValue: st.maxValue ? n(st.maxValue) : null,
        reference: st.reference || null, enabled: st.enabled,
        ...(f.kind === "power" ? { exponent: n(st.exponent) } : {}),
        ...(f.kind === "category" ? { categories: st.cats.map((c) => ({ id: c.id, coefficient: n(c.coefficient) })) } : {}),
      });
      toast("Показатель сохранён");
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 bg-canvas px-4 py-4">
      {f.kind === "category" && (
        <div>
          <div className="label">Коэффициенты категорий</div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {st.cats.map((c, i) => (
              <label key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]">
                <span className="truncate">{c.label}</span>
                <input className="input num w-20 py-1 text-right" value={c.coefficient} onChange={(e) => { const cats = [...st.cats]; cats[i] = { ...c, coefficient: e.target.value }; setSt({ ...st, cats }); }} />
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {f.kind === "discount" && <div><label className="label">Значение (доля)</label><input className="input num" value={st.value} onChange={(e) => setSt({ ...st, value: e.target.value })} placeholder="-0.05" /></div>}
        {f.kind === "power" && <div><label className="label">Показатель b</label><input className="input num" value={st.exponent} onChange={(e) => setSt({ ...st, exponent: e.target.value })} /></div>}
        <div><label className="label">Минимум (доля)</label><input className="input num" value={st.minValue} onChange={(e) => setSt({ ...st, minValue: e.target.value })} /></div>
        <div><label className="label">Максимум (доля)</label><input className="input num" value={st.maxValue} onChange={(e) => setSt({ ...st, maxValue: e.target.value })} /></div>
        <div className="lg:col-span-2"><label className="label">Ссылка на источник (таблица, страница)</label><input className="input" value={st.reference} onChange={(e) => setSt({ ...st, reference: e.target.value })} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#176b4d]" checked={st.enabled} onChange={(e) => setSt({ ...st, enabled: e.target.checked })} />Применять показатель</label>
        {error && <span className="text-[13px] text-err">{error}</span>}
        <div className="ml-auto flex gap-2"><button className="btn btn-secondary" onClick={onCancel}>Отмена</button><button className="btn btn-primary" disabled={busy} onClick={save}>Сохранить</button></div>
      </div>
    </div>
  );
}

export function DirectoryDetail({ id }: { id: string }) {
  const [s, setS] = useState<Src | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | "1" | "2">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.get<Src>(`/api/directory/${id}`).then(setS).catch((e) => setError(errorText(e)));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const factors = useMemo(() => {
    let f = s?.factors ?? [];
    if (stage !== "all") f = f.filter((x) => String(x.stage) === stage);
    const t = q.trim().toLowerCase();
    if (t) f = f.filter((x) => x.name.toLowerCase().includes(t) || x.categories.some((c) => c.label.toLowerCase().includes(t)));
    return f;
  }, [s, stage, q]);

  if (error) return <Notice tone="err" title="Не удалось открыть справочник">{error}</Notice>;
  if (!s) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-[1360px]">
      <PageHeader
        eyebrow={<Link href="/app/directory" className="inline-flex items-center gap-1 hover:text-ink"><Icon name="chevronRight" size={12} className="rotate-180" />Справочник корректировок</Link>}
        title={s.name}
        description={`Редакция ${s.edition}`}
        actions={s.isDemo ? <Badge tone="warn">Демонстрационный</Badge> : s.editable ? <Badge tone="brand">Моя редакция</Badge> : <Badge tone="neutral">Системный · только чтение</Badge>}
      />
      <section className="card mb-4 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <KV label="Издатель / источник">{s.publisher ?? "—"}</KV>
        <KV label="Дата актуальности">{fmtDate(s.actualDate)}</KV>
        <KV label="Лицензия">{LICENSE[s.licenseType] ?? s.licenseType}</KV>
        <KV label="Показателей">{s.factors.length} · применяется {s.factors.filter((f) => f.enabled).length}</KV>
        <KV label="Используется в оценках">{s._count.assessments}</KV>
      </section>
      {s.licenseNote && <Notice tone={s.isDemo ? "warn" : "info"} className="mb-4">{s.licenseNote}</Notice>}
      {!s.editable && <Notice className="mb-4">Системная редакция доступна только для чтения. Чтобы изменить значения, создайте собственную редакцию в списке справочников.</Notice>}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 md:flex-row md:items-center md:justify-between">
          <SearchInput className="md:w-72" value={q} onChange={setQ} placeholder="Поиск показателя или категории" />
          <Segmented size="sm" value={stage} onChange={setStage} options={[["all", "Все"], ["1", "1-я группа"], ["2", "2-я группа"]]} />
        </div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[960px]">
            <thead><tr><th>Показатель</th><th>Тип</th><th className="w-[34%]">Значения</th><th>Диапазон</th><th>Ссылка на источник</th><th>Статус</th>{s.editable && <th className="w-0"></th>}</tr></thead>
            <tbody>
              {factors.map((f) => (
                <Fragment key={f.id}>
                  <tr className={f.enabled ? "" : "text-muted"}>
                    <td><div className="font-medium text-ink">{f.name}</div><div className="text-[11.5px] text-muted">{f.stage === 1 ? "1-я группа" : "2-я группа"}</div></td>
                    <td className="text-[12.5px]"><div>{KIND[f.kind]}</div><div className="text-[11.5px] text-muted">{KIND_HINT[f.kind]}</div></td>
                    <td><Values f={f} /></td>
                    <td className="num text-[12.5px]">{range(f.minValue, f.maxValue)}</td>
                    <td className="text-[12.5px] text-zinc-700">{f.reference ?? <span className="text-muted">—</span>}</td>
                    <td>{f.enabled ? <Badge tone="ok">Применяется</Badge> : <Badge tone="neutral">Выключен</Badge>}</td>
                    {s.editable && <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === f.id ? null : f.id)}><Icon name="edit" size={14} />Изменить</button></td>}
                  </tr>
                  {editing === f.id && (
                    <tr><td colSpan={7} className="!p-0"><Editor f={f} sid={s.id} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} /></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

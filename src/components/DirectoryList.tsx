"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Modal, Notice, PageHeader, SearchInput, Segmented, Skeleton, toast } from "@/components/ui/kit";

interface Src { id: string; code: string; name: string; edition: string; publisher: string | null; actualDate: string | null; createdAt: string; licenseType: string; isDemo: boolean; isActive: boolean; editable: boolean; _count: { factors: number; assessments: number } }

export const LICENSE: Record<string, string> = { own: "Собственные исследования", licensed: "Лицензированный", public: "Открытый источник", demo: "Демонстрационный" };

function statusOf(s: Src) {
  if (s.isDemo) return <Badge tone="warn">Демо</Badge>;
  if (!s.isActive) return <Badge tone="neutral">Неактивен</Badge>;
  return <Badge tone="ok">Активен</Badge>;
}

export function DirectoryList() {
  const [list, setList] = useState<Src[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | "system" | "mine">("all");
  const [cloneFrom, setCloneFrom] = useState<Src | null>(null);
  const [form, setForm] = useState({ name: "", edition: "", publisher: "", actualDate: "", licenseType: "own", licenseNote: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Src[]>("/api/directory").then(setList).catch((e) => setError(errorText(e)));
  }, []);

  const view = useMemo(() => {
    let r = list ?? [];
    if (cat === "system") r = r.filter((x) => !x.editable);
    if (cat === "mine") r = r.filter((x) => x.editable);
    const s = q.trim().toLowerCase();
    if (s) r = r.filter((x) => [x.name, x.edition, x.publisher, x.code].some((v) => v?.toLowerCase().includes(s)));
    return r;
  }, [list, cat, q]);

  function openClone(s: Src) {
    setCloneFrom(s);
    setForm({ name: s.isDemo ? "Мой справочник корректировок" : s.name, edition: "", publisher: "", actualDate: new Date().toISOString().slice(0, 10), licenseType: "own", licenseNote: "" });
    setError(null);
  }

  async function clone(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ id: string }>("/api/directory", { fromId: cloneFrom!.id, ...form });
      toast("Редакция создана");
      location.href = `/app/directory/${r.id}`;
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const base = list?.find((x) => x.isDemo) ?? list?.[0];

  return (
    <div className="mx-auto max-w-[1360px]">
      <PageHeader
        title="Справочник корректировок"
        description="Показатель → коэффициент → диапазон → источник → редакция → дата актуальности"
        actions={base && <button className="btn btn-primary" onClick={() => openClone(base)}><Icon name="plus" size={15} />Новая редакция</button>}
      />
      <Notice className="mb-4">
        Редакция, использованная в зафиксированном расчёте, не изменяется — старые оценки всегда воспроизводятся на своих коэффициентах. Чтобы изменить значения, создайте новую редакцию.
      </Notice>
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 md:flex-row md:items-center md:justify-between">
          <SearchInput className="md:w-80" value={q} onChange={setQ} placeholder="Поиск по названию, редакции, издателю" />
          <Segmented size="sm" value={cat} onChange={setCat} options={[["all", "Все"], ["system", "Системные"], ["mine", "Мои редакции"]]} />
        </div>
        {!list ? (
          <div className="space-y-2 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : view.length === 0 ? (
          <EmptyState icon="sliders" title={cat === "mine" ? "Собственных редакций пока нет" : "Ничего не найдено"} action={cat === "mine" && base ? <button className="btn btn-primary" onClick={() => openClone(base)}>Создать редакцию</button> : undefined}>
            {cat === "mine" ? "Создайте редакцию на основе существующего справочника и укажите источник значений." : "Измените условия поиска."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl tbl-hover min-w-[920px]">
              <thead>
                <tr><th>Справочник</th><th>Редакция</th><th>Источник / издатель</th><th>Актуален на</th><th>Лицензия</th><th>Статус</th><th className="text-right">Показателей</th><th className="text-right">Оценок</th><th className="w-0"></th></tr>
              </thead>
              <tbody>
                {view.map((s) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => (location.href = `/app/directory/${s.id}`)}>
                    <td>
                      <Link href={`/app/directory/${s.id}`} className="font-medium text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>{s.name}</Link>
                      <div className="text-[12px] text-muted">{s.editable ? "Моя редакция" : "Системный справочник"}</div>
                    </td>
                    <td className="num">{s.edition}</td>
                    <td className="text-zinc-700">{s.publisher ?? "—"}</td>
                    <td className="num">{fmtDate(s.actualDate)}</td>
                    <td className="text-[12.5px]">{LICENSE[s.licenseType] ?? s.licenseType}</td>
                    <td>{statusOf(s)}</td>
                    <td className="num text-right">{s._count.factors}</td>
                    <td className="num text-right">{s._count.assessments}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Link href={`/app/directory/${s.id}`} className="btn btn-secondary btn-sm">Открыть</Link>
                        <button className="btn btn-ghost btn-sm" onClick={() => openClone(s)} title="Создать редакцию на основе этой">Копировать</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={!!cloneFrom}
        onClose={() => setCloneFrom(null)}
        title="Новая редакция справочника"
        description={cloneFrom ? `Копия «${cloneFrom.name}», ред. ${cloneFrom.edition}. Значения можно изменить после создания.` : undefined}
        footer={
          <>
            {error && <span className="mr-auto text-[13px] text-err">{error}</span>}
            <button className="btn btn-secondary" onClick={() => setCloneFrom(null)}>Отмена</button>
            <button className="btn btn-primary" form="clone-form" disabled={busy}>Создать редакцию</button>
          </>
        }
      >
        <form id="clone-form" onSubmit={clone} className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2"><label className="label">Название</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Номер редакции</label><input className="input" required placeholder="2026.2" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} /></div>
          <div><label className="label">Издатель / автор</label><input className="input" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></div>
          <div><label className="label">Дата актуальности</label><input className="input" type="date" value={form.actualDate} onChange={(e) => setForm({ ...form, actualDate: e.target.value })} /></div>
          <div>
            <label className="label">Тип лицензии</label>
            <select className="input" value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })}>
              <option value="own">Собственные исследования</option><option value="licensed">Лицензированный справочник</option><option value="public">Открытый источник</option>
            </select>
          </div>
          <div className="md:col-span-3"><label className="label">Сведения об источнике / лицензии</label><input className="input" value={form.licenseNote} onChange={(e) => setForm({ ...form, licenseNote: e.target.value })} placeholder="Издание, таблица, страница или договор" /></div>
        </form>
      </Modal>
    </div>
  );
}

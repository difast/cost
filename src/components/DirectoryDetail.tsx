"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtPercent } from "@/core/format";
import { Icon } from "@/components/ui/Icon";
import { Badge, ConfirmModal, KV, Notice, PageHeader, PageSkeleton, SearchInput, Segmented, toast } from "@/components/ui/kit";
import { LICENSE } from "./DirectoryList";
import { FORMULA_VARIABLE_LABELS } from "@/core/adjustments/attributes";

interface Cat { id: string; code: string; label: string; coefficient: string; minCoefficient: string | null; maxCoefficient: string | null }
interface Factor { id: string; code: string; name: string; kind: string; attribute: string | null; stage: number; value: string | null; minValue: string | null; maxValue: string | null; params: Record<string, unknown>; reference: string | null; description: string | null; enabled: boolean; categories: Cat[]; groupName: string | null; region: string | null; methodology: string | null; comment: string | null; actualDate: string | null }
interface Src { id: string; name: string; edition: string; publisher: string | null; actualDate: string | null; licenseType: string; licenseNote: string | null; isDemo: boolean; isActive: boolean; editable: boolean; factors: Factor[]; _count: { assessments: number } }

const KIND: Record<string, string> = { discount: "Фиксированная скидка", category: "Коэффициенты категорий", power: "Формула (степенная)", formula: "Формула", manual: "Экспертная" };
const KIND_HINT: Record<string, string> = {
  discount: "K = 1 + скидка; применяется ко всем аналогам",
  category: "K = k(объект) / k(аналог); корректировка = K − 1",
  power: "K = (So / Sa)^b; корректировка = K − 1",
  formula: "K — по формуле; корректировка = K − 1",
  manual: "Определяется оценщиком, по умолчанию 0 %",
};
const VARS_HINT = `Переменные (o — объект, a — аналог): ${Object.entries(FORMULA_VARIABLE_LABELS).map(([k, v]) => `${k}o/${k}a — ${v}`).join("; ")}. Операции: + − * / ^, скобки, min, max, abs; дробная часть — через точку.`;
const range = (min: string | null, max: string | null) => (min || max ? `${min ? fmtPercent(min, 1) : "−∞"} … ${max ? fmtPercent(max, 1) : "+∞"}` : "—");

function Values({ f }: { f: Factor }) {
  if (f.kind === "discount") return <span className="num font-medium">{f.value ? fmtPercent(f.value, 2, true) : "—"}</span>;
  if (f.kind === "power") return <span className="num">K = (So / Sa)^({String(f.params.exponent ?? "—").replace(".", ",")})</span>;
  if (f.kind === "formula") return <span className="num">K = {String(f.params.expression ?? "—")}</span>;
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
  const [st, setSt] = useState({
    value: f.value ?? "", minValue: f.minValue ?? "", maxValue: f.maxValue ?? "", reference: f.reference ?? "", enabled: f.enabled,
    exponent: String(f.params.exponent ?? ""), expression: String(f.params.expression ?? ""),
    groupName: f.groupName ?? "", region: f.region ?? "", methodology: f.methodology ?? "", comment: f.comment ?? "", actualDate: f.actualDate ? f.actualDate.slice(0, 10) : "",
    cats: f.categories.map((c) => ({ id: c.id, label: c.label, coefficient: c.coefficient })),
  });
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
        groupName: st.groupName || null, region: st.region || null, methodology: st.methodology || null, comment: st.comment || null, actualDate: st.actualDate || null,
        ...(f.kind === "power" ? { exponent: n(st.exponent) } : {}),
        ...(f.kind === "formula" ? { expression: st.expression } : {}),
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
        {f.kind === "formula" && <div className="sm:col-span-2 lg:col-span-5"><label className="label">Формула коэффициента K</label><input className="input num" value={st.expression} onChange={(e) => setSt({ ...st, expression: e.target.value })} placeholder="(So / Sa)^(-0.12)" /><p className="mt-1 text-[11.5px] text-muted">{VARS_HINT}</p></div>}
        <div><label className="label">Минимум (доля)</label><input className="input num" value={st.minValue} onChange={(e) => setSt({ ...st, minValue: e.target.value })} /></div>
        <div><label className="label">Максимум (доля)</label><input className="input num" value={st.maxValue} onChange={(e) => setSt({ ...st, maxValue: e.target.value })} /></div>
        <div className="lg:col-span-2"><label className="label">Ссылка на источник (таблица, страница)</label><input className="input" value={st.reference} onChange={(e) => setSt({ ...st, reference: e.target.value })} /></div>
        <div><label className="label">Группа фактора</label><input className="input" value={st.groupName} onChange={(e) => setSt({ ...st, groupName: e.target.value })} placeholder="Физические характеристики" /></div>
        <div><label className="label">Регион / группа регионов</label><input className="input" value={st.region} onChange={(e) => setSt({ ...st, region: e.target.value })} /></div>
        <div><label className="label">Дата актуальности</label><input className="input" type="date" value={st.actualDate} onChange={(e) => setSt({ ...st, actualDate: e.target.value })} /></div>
        <div className="lg:col-span-2"><label className="label">Методика</label><input className="input" value={st.methodology} onChange={(e) => setSt({ ...st, methodology: e.target.value })} /></div>
        <div className="sm:col-span-2 lg:col-span-5"><label className="label">Комментарий</label><input className="input" value={st.comment} onChange={(e) => setSt({ ...st, comment: e.target.value })} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#176b4d]" checked={st.enabled} onChange={(e) => setSt({ ...st, enabled: e.target.checked })} />Применять показатель</label>
        {error && <span className="text-[13px] text-err">{error}</span>}
        <div className="ml-auto flex gap-2"><button className="btn btn-secondary" onClick={onCancel}>Отмена</button><button className="btn btn-primary" disabled={busy} onClick={save}>Сохранить</button></div>
      </div>
    </div>
  );
}

const ATTR_OPTIONS: Array<[string, string]> = [
  ["floor_category", "Этаж (первый / средний / последний)"], ["wall_material", "Материал стен"], ["finishing", "Отделка"], ["furniture", "Мебель"],
  ["house_condition", "Состояние дома"], ["metro_distance", "Расстояние до метро"], ["rights", "Передаваемые права"],
];

function NewFactor({ sid, onDone, onCancel }: { sid: string; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ code: "", name: "", kind: "formula", attribute: "floor_category", stage: "2", value: "", minValue: "", maxValue: "", expression: "", groupName: "", region: "", methodology: "", reference: "", cats: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = (v: string) => (v.trim() ? v.replace(",", ".").trim() : null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      // категории: по одной на строку «код; название; коэффициент»
      const categories = f.kind === "category" ? f.cats.split("\n").map((l) => l.split(";").map((x) => x.trim())).filter((x) => x.length >= 3 && x[0]).map(([code, label, k]) => ({ code, label, coefficient: k.replace(",", ".") })) : [];
      await api.post(`/api/directory/${sid}/factors`, {
        code: f.code, name: f.name, kind: f.kind, attribute: f.kind === "category" ? f.attribute : null, stage: Number(f.stage),
        value: n(f.value), minValue: n(f.minValue), maxValue: n(f.maxValue), expression: f.kind === "formula" ? f.expression : null,
        groupName: f.groupName || null, region: f.region || null, methodology: f.methodology || null, reference: f.reference || null, categories,
      });
      toast("Показатель добавлен");
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  const inp = (k: keyof typeof f, label: string, cls = "", ph = "") => (
    <div className={cls}><label className="label">{label}</label><input className="input" value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <div className="space-y-3 border-b border-line bg-canvas px-4 py-4">
      <div className="text-[13px] font-semibold text-ink">Новый показатель</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {inp("code", "Код (латиницей)", "", "ceiling_height")}
        {inp("name", "Название", "lg:col-span-2", "Высота потолков")}
        <div><label className="label">Тип</label><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="formula">Формула</option><option value="category">Коэффициенты категорий</option><option value="discount">Фиксированная скидка</option><option value="manual">Экспертная</option></select></div>
        <div><label className="label">Группа корректировок</label><select className="input" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}><option value="1">1-я (сделка, рынок)</option><option value="2">2-я (характеристики)</option></select></div>
        {f.kind === "formula" && <div className="sm:col-span-2 lg:col-span-5"><label className="label">Формула коэффициента K</label><input className="input num" value={f.expression} placeholder="(So / Sa)^(-0.12)" onChange={(e) => setF({ ...f, expression: e.target.value })} /><p className="mt-1 text-[11.5px] text-muted">{VARS_HINT}</p></div>}
        {f.kind === "category" && (
          <>
            <div className="lg:col-span-2"><label className="label">Признак</label><select className="input" value={f.attribute} onChange={(e) => setF({ ...f, attribute: e.target.value })}>{ATTR_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="label">Категории: «код; название; коэффициент», по одной на строку</label><textarea className="input num" rows={3} value={f.cats} onChange={(e) => setF({ ...f, cats: e.target.value })} placeholder={"first; Первый этаж; 0.94\nmiddle; Средний этаж; 1"} /></div>
          </>
        )}
        {f.kind === "discount" && inp("value", "Значение (доля)", "", "-0.05")}
        {inp("minValue", "Минимум (доля)")}
        {inp("maxValue", "Максимум (доля)")}
        {inp("groupName", "Группа фактора", "", "Физические характеристики")}
        {inp("region", "Регион / группа регионов")}
        {inp("reference", "Источник (таблица, страница)", "lg:col-span-2")}
        {inp("methodology", "Методика", "sm:col-span-2 lg:col-span-3")}
      </div>
      <div className="flex items-center gap-3">
        {error && <span className="text-[13px] text-err">{error}</span>}
        <div className="ml-auto flex gap-2"><button className="btn btn-secondary" onClick={onCancel}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.code || !f.name} onClick={save}>Добавить</button></div>
      </div>
    </div>
  );
}

export function DirectoryDetail({ id }: { id: string }) {
  const [s, setS] = useState<Src | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | "1" | "2">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  async function verify() {
    try {
      await api.patch(`/api/directory/${id}`, { isDemo: false, confirmVerified: true });
      toast("Пометка «демонстрационный» снята");
      load();
    } catch (e) {
      toast(errorText(e), "err");
    } finally {
      setVerifying(false);
    }
  }
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
      {s.isDemo && s.editable && (
        <Notice tone="warn" className="mb-4" action={<button className="btn btn-secondary btn-sm" onClick={() => setVerifying(true)}>Значения подтверждены</button>}>
          Редакция создана из демонстрационного справочника — значения по-прежнему демонстрационные. Замените их значениями из источника и подтвердите.
        </Notice>
      )}
      {!s.editable && <Notice className="mb-4">Системная редакция доступна только для чтения. Чтобы изменить значения, создайте собственную редакцию в списке справочников.</Notice>}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 md:flex-row md:items-center md:justify-between">
          <SearchInput className="md:w-72" value={q} onChange={setQ} placeholder="Поиск показателя или категории" />
          <div className="flex items-center gap-2">
            <Segmented size="sm" value={stage} onChange={setStage} options={[["all", "Все"], ["1", "1-я группа"], ["2", "2-я группа"]]} />
            {s.editable && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(!adding)}><Icon name="plus" size={14} />Показатель</button>}
          </div>
        </div>
        {adding && <NewFactor sid={s.id} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
        <div className="overflow-x-auto">
          <table className="tbl min-w-[960px]">
            <thead><tr><th>Показатель</th><th>Тип</th><th className="w-[34%]">Значения</th><th>Диапазон</th><th>Ссылка на источник</th><th>Статус</th>{s.editable && <th className="w-0"></th>}</tr></thead>
            <tbody>
              {factors.map((f) => (
                <Fragment key={f.id}>
                  <tr className={f.enabled ? "" : "text-muted"}>
                    <td>
                      <div className="font-medium text-ink">{f.name}</div>
                      <div className="text-[11.5px] text-muted">{f.groupName ?? (f.stage === 1 ? "1-я группа" : "2-я группа")}{f.region ? ` · ${f.region}` : ""}{f.actualDate ? ` · на ${fmtDate(f.actualDate)}` : ""}</div>
                      {f.methodology && <div className="mt-0.5 max-w-[260px] text-[11.5px] leading-snug text-muted" title={f.methodology}>{f.methodology.length > 90 ? `${f.methodology.slice(0, 90)}…` : f.methodology}</div>}
                    </td>
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
      <ConfirmModal open={verifying} tone="primary" confirmLabel="Подтвердить" title="Снять пометку «демонстрационный»?" onClose={() => setVerifying(false)} onConfirm={verify}>
        Подтвердите, что все значения этой редакции проверены и подтверждены источником (справочник, исследование рынка). После этого проверки перестанут предупреждать о демонстрационных данных.
      </ConfirmModal>
    </div>
  );
}

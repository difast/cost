"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, SaveBar, TextArea, TextInput } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { Icon } from "@/components/ui/Icon";
import { Badge, Notice, PageHeader, PageSkeleton, Panel, toast } from "@/components/ui/kit";
import { fmtDate } from "@/core/format";

type P = Record<string, unknown>;

const SECTIONS = [
  ["personal", "Личные данные"],
  ["sro", "СРО"],
  ["qualification", "Квалификация"],
  ["insurance", "Страхование"],
  ["organization", "Организация"],
  ["signature", "Реквизиты и подпись"],
] as const;

const REQUIRED: Array<[string, string]> = [
  ["fullName", "ФИО"], ["sroName", "СРО"], ["sroRegistryNumber", "Номер в реестре СРО"],
  ["qualificationCertNumber", "Квалификационный аттестат"], ["insurancePolicyNumber", "Полис страхования"],
];

function daysLeft(v: unknown) {
  if (!v) return null;
  return Math.floor((new Date(String(v)).getTime() - Date.now()) / 86_400_000);
}

function plural(n: number, f: [string, string, string]) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b >= 2 && b <= 4 ? f[1] : f[2];
}

function Validity({ date }: { date: unknown }) {
  const n = daysLeft(date);
  if (n === null) return <span className="text-[12.5px] text-muted">срок не указан</span>;
  if (n < 0) return <Badge tone="err">истёк {fmtDate(String(date))}</Badge>;
  if (n <= 30) return <Badge tone="warn">заканчивается через {n} {plural(n, ["день", "дня", "дней"])}</Badge>;
  return <Badge tone="ok">действует ещё {n} {plural(n, ["день", "дня", "дней"])}</Badge>;
}

export function ProfileForm() {
  const [initial, setInitial] = useState<P | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<P>("/api/profile").then((p) => {
      const { id: _i, userId: _u, updatedAt: _t, ...rest } = p;
      setInitial(rest);
    }).catch((e) => setError(errorText(e)));
  }, []);
  if (error) return <Notice tone="err">{error}</Notice>;
  if (!initial) return <PageSkeleton />;
  return <Inner initial={initial} />;
}

function Inner({ initial }: { initial: P }) {
  const { draft: d, set, dirty, changes, reset } = useDraft(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sigRef = useRef<HTMLInputElement>(null);
  const welcome = typeof window !== "undefined" && location.search.includes("welcome");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/profile", changes);
      toast("Профиль сохранён");
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function uploadSignature(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.upload<{ id: string }>("/api/profile/signature", fd);
      set("signatureFileId", r.id);
      toast("Подпись загружена — не забудьте сохранить профиль", "info");
    } catch (e) {
      toast(errorText(e), "err");
    }
  }

  const missing = REQUIRED.filter(([k]) => !d[k] || String(d[k]).trim() === "");
  const docs: Array<[string, string, string]> = [
    ["Квалификационный аттестат", "qualificationCertValidUntil", d.qualificationCertNumber ? `№ ${d.qualificationCertNumber}` : "номер не указан"],
    ["Полис страхования оценщика", "insuranceValidUntil", d.insurancePolicyNumber ? `№ ${d.insurancePolicyNumber}${d.insuranceCompany ? `, ${d.insuranceCompany}` : ""}` : "номер не указан"],
    ["Полис страхования организации", "legalEntityInsuranceValidUntil", d.legalEntityInsurancePolicy ? `№ ${d.legalEntityInsurancePolicy}` : "если оценщик работает в организации"],
  ];

  return (
    <div className="mx-auto max-w-[1360px]">
      <PageHeader
        title="Профиль оценщика"
        description="Сведения подставляются во все отчёты. Сроки действия документов проверяются при каждой оценке."
        actions={missing.length ? <Badge tone="warn">Не заполнено: {missing.length}</Badge> : <Badge tone="ok" icon="check">Профиль заполнен</Badge>}
      />
      {welcome && <Notice tone="info" className="mb-4" title="Добро пожаловать">Заполните сведения об оценщике — без них отчёт не будет сформирован.</Notice>}

      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden h-fit lg:sticky lg:top-6 lg:block" aria-label="Разделы профиля">
          <ul className="space-y-0.5 text-[13px]">
            {SECTIONS.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-zinc-700 hover:bg-subtle hover:text-ink">{label}</a></li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          <Panel title="Сроки действия документов" bodyClassName="">
            <ul className="divide-y divide-line">
              {docs.map(([label, key, sub]) => (
                <li key={key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[13.5px] font-medium text-ink">{label}</div>
                    <div className="text-[12px] text-muted">{sub}{d[key] ? ` · до ${fmtDate(String(d[key]))}` : ""}</div>
                  </div>
                  <Validity date={d[key]} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel id="personal" title="Личные данные">
            <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
              <Field label="ФИО полностью" required className="md:col-span-2"><TextInput d={d} k="fullName" set={set} /></Field>
              <Field label="Должность"><TextInput d={d} k="position" set={set} /></Field>
              <Field label="Телефон"><TextInput d={d} k="phone" set={set} /></Field>
              <Field label="Email"><TextInput d={d} k="email" set={set} /></Field>
              <Field label="Стаж в оценке"><NumInput d={d} k="experienceYears" set={set} suffix="лет" /></Field>
              <Field label="Почтовый адрес" className="md:col-span-3"><TextInput d={d} k="postalAddress" set={set} /></Field>
              <Field label="Образование" className="md:col-span-3" hint="Диплом, учебное заведение, год"><TextArea d={d} k="education" set={set} rows={2} /></Field>
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel id="sro" title="Членство в СРО">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Наименование СРО" required className="col-span-2"><TextInput d={d} k="sroName" set={set} /></Field>
                <Field label="Номер в реестре" required><TextInput d={d} k="sroRegistryNumber" set={set} /></Field>
                <Field label="Дата включения"><TextInput d={d} k="sroMembershipDate" set={set} type="date" /></Field>
                <Field label="Адрес СРО" className="col-span-2"><TextInput d={d} k="sroAddress" set={set} /></Field>
              </div>
            </Panel>
            <Panel id="qualification" title="Квалификационный аттестат" actions={<Validity date={d.qualificationCertValidUntil} />}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Номер" required><TextInput d={d} k="qualificationCertNumber" set={set} /></Field>
                <Field label="Дата выдачи"><TextInput d={d} k="qualificationCertDate" set={set} type="date" /></Field>
                <Field label="Действует до"><TextInput d={d} k="qualificationCertValidUntil" set={set} type="date" /></Field>
                <Field label="Направление"><TextInput d={d} k="qualificationArea" set={set} /></Field>
              </div>
            </Panel>
          </div>

          <Panel id="insurance" title="Страхование ответственности оценщика" actions={<Validity date={d.insuranceValidUntil} />}>
            <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
              <Field label="Страховая компания" className="md:col-span-2"><TextInput d={d} k="insuranceCompany" set={set} /></Field>
              <Field label="Номер полиса" required><TextInput d={d} k="insurancePolicyNumber" set={set} /></Field>
              <Field label="Страховая сумма"><NumInput d={d} k="insuranceSum" set={set} suffix="₽" /></Field>
              <Field label="Действует с"><TextInput d={d} k="insuranceValidFrom" set={set} type="date" /></Field>
              <Field label="Действует до"><TextInput d={d} k="insuranceValidUntil" set={set} type="date" /></Field>
            </div>
          </Panel>

          <Panel id="organization" title="Организация" description="Юридическое лицо, с которым оценщик заключил трудовой договор (если есть)" actions={d.legalEntityName ? <Validity date={d.legalEntityInsuranceValidUntil} /> : undefined}>
            <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
              <Field label="Наименование" className="md:col-span-3"><TextInput d={d} k="legalEntityName" set={set} /></Field>
              <Field label="ИНН"><TextInput d={d} k="legalEntityInn" set={set} /></Field>
              <Field label="ОГРН"><TextInput d={d} k="legalEntityOgrn" set={set} /></Field>
              <Field label="Адрес"><TextInput d={d} k="legalEntityAddress" set={set} /></Field>
              <Field label="Страховщик организации"><TextInput d={d} k="legalEntityInsuranceCompany" set={set} /></Field>
              <Field label="Полис организации"><TextInput d={d} k="legalEntityInsurancePolicy" set={set} /></Field>
              <Field label="Страховая сумма"><NumInput d={d} k="legalEntityInsuranceSum" set={set} suffix="₽" /></Field>
              <Field label="Полис действует до"><TextInput d={d} k="legalEntityInsuranceValidUntil" set={set} type="date" /></Field>
            </div>
          </Panel>

          <Panel id="signature" title="Реквизиты и подпись">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <Field label="Банковские реквизиты"><TextArea d={d} k="bankDetails" set={set} rows={4} /></Field>
              <div>
                <div className="label">Изображение подписи</div>
                <input ref={sigRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { if (e.target.files?.[0]) uploadSignature(e.target.files[0]); e.target.value = ""; }} />
                <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-line-strong bg-canvas">
                  {d.signatureFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${d.signatureFileId}?inline=1`} alt="Подпись оценщика" className="max-h-20 object-contain" />
                  ) : (
                    <span className="text-[12.5px] text-muted">PNG с прозрачным фоном</span>
                  )}
                </div>
                <button className="btn btn-secondary btn-sm mt-2 w-full" onClick={() => sigRef.current?.click()}><Icon name="upload" size={14} />{d.signatureFileId ? "Заменить подпись" : "Загрузить подпись"}</button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={reset} error={error} />
    </div>
  );
}

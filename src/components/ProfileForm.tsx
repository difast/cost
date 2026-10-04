"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field, NumInput, SaveBar, TextArea, TextInput } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { fmtDate } from "@/core/format";

type P = Record<string, unknown>;

function Expiry({ date }: { date: unknown }) {
  if (!date) return null;
  const t = new Date(String(date)).getTime();
  const days = Math.floor((t - Date.now()) / 86_400_000);
  if (days < 0) return <span className="badge bg-red-50 text-err">истёк {fmtDate(String(date))}</span>;
  if (days < 30) return <span className="badge bg-amber-50 text-warn">истекает через {days} дн.</span>;
  return <span className="badge bg-green-50 text-ok">действует</span>;
}

export function ProfileForm() {
  const [initial, setInitial] = useState<P | null>(null);
  useEffect(() => {
    api.get<P>("/api/profile").then((p) => {
      const { id: _i, userId: _u, updatedAt: _t, ...rest } = p;
      setInitial(rest);
    });
  }, []);
  if (!initial) return <div className="text-muted">Загрузка…</div>;
  return <Inner initial={initial} />;
}

function Inner({ initial }: { initial: P }) {
  const { draft: d, set, dirty, changes, reset } = useDraft(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const sigRef = useRef<HTMLInputElement>(null);
  const welcome = typeof window !== "undefined" && location.search.includes("welcome");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/profile", changes);
      setSaved(true);
      location.reload();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function uploadSignature(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("kind", "signature");
    try {
      const r = await api.upload<{ id: string }>("/api/profile/signature", fd);
      set("signatureFileId", r.id);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Профиль оценщика</h1>
        <p className="text-muted">Заполняется один раз и автоматически подставляется во все отчёты. Сроки действия документов контролируются.</p>
      </div>
      {welcome && <div className="rounded-md bg-blue-50 px-4 py-3 text-brand">Добро пожаловать! Заполните сведения об оценщике — без них отчёт не будет сформирован.</div>}

      <div className="card p-4">
        <div className="card-t mb-3">Оценщик</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="ФИО полностью" className="md:col-span-2"><TextInput d={d} k="fullName" set={set} /></Field>
          <Field label="Должность"><TextInput d={d} k="position" set={set} /></Field>
          <Field label="Телефон"><TextInput d={d} k="phone" set={set} /></Field>
          <Field label="Email"><TextInput d={d} k="email" set={set} /></Field>
          <Field label="Стаж в оценке, лет"><NumInput d={d} k="experienceYears" set={set} /></Field>
          <Field label="Почтовый адрес" className="md:col-span-3"><TextInput d={d} k="postalAddress" set={set} /></Field>
          <Field label="Образование (диплом, учебное заведение)" className="md:col-span-3"><TextArea d={d} k="education" set={set} rows={2} /></Field>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="card-t mb-3">Членство в СРО</div>
          <div className="grid gap-3">
            <Field label="Наименование СРО"><TextInput d={d} k="sroName" set={set} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Рег. номер в реестре"><TextInput d={d} k="sroRegistryNumber" set={set} /></Field>
              <Field label="Дата включения"><TextInput d={d} k="sroMembershipDate" set={set} type="date" /></Field>
            </div>
            <Field label="Адрес СРО"><TextInput d={d} k="sroAddress" set={set} /></Field>
          </div>
        </div>
        <div className="card p-4">
          <div className="card-t mb-3">Квалификационный аттестат</div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Номер"><TextInput d={d} k="qualificationCertNumber" set={set} /></Field>
              <Field label="Дата выдачи"><TextInput d={d} k="qualificationCertDate" set={set} type="date" /></Field>
            </div>
            <Field label="Действует до" source={<Expiry date={d.qualificationCertValidUntil} />}><TextInput d={d} k="qualificationCertValidUntil" set={set} type="date" /></Field>
            <Field label="Направление"><TextInput d={d} k="qualificationArea" set={set} /></Field>
          </div>
        </div>
        <div className="card p-4">
          <div className="card-t mb-3">Страхование ответственности оценщика</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Страховая компания" className="col-span-2"><TextInput d={d} k="insuranceCompany" set={set} /></Field>
            <Field label="Номер полиса"><TextInput d={d} k="insurancePolicyNumber" set={set} /></Field>
            <Field label="Страховая сумма, ₽"><NumInput d={d} k="insuranceSum" set={set} /></Field>
            <Field label="Действует с"><TextInput d={d} k="insuranceValidFrom" set={set} type="date" /></Field>
            <Field label="Действует до" source={<Expiry date={d.insuranceValidUntil} />}><TextInput d={d} k="insuranceValidUntil" set={set} type="date" /></Field>
          </div>
        </div>
        <div className="card p-4">
          <div className="card-t mb-3">Юридическое лицо (работодатель)</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Наименование" className="col-span-2"><TextInput d={d} k="legalEntityName" set={set} /></Field>
            <Field label="ИНН"><TextInput d={d} k="legalEntityInn" set={set} /></Field>
            <Field label="ОГРН"><TextInput d={d} k="legalEntityOgrn" set={set} /></Field>
            <Field label="Адрес" className="col-span-2"><TextInput d={d} k="legalEntityAddress" set={set} /></Field>
            <Field label="Страховщик юрлица"><TextInput d={d} k="legalEntityInsuranceCompany" set={set} /></Field>
            <Field label="Полис юрлица"><TextInput d={d} k="legalEntityInsurancePolicy" set={set} /></Field>
            <Field label="Страховая сумма, ₽"><NumInput d={d} k="legalEntityInsuranceSum" set={set} /></Field>
            <Field label="Действует до" source={<Expiry date={d.legalEntityInsuranceValidUntil} />}><TextInput d={d} k="legalEntityInsuranceValidUntil" set={set} type="date" /></Field>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="card-t mb-3">Реквизиты и подпись</div>
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <Field label="Банковские реквизиты"><TextArea d={d} k="bankDetails" set={set} rows={3} /></Field>
          <Field label="Изображение подписи (PNG)">
            <input ref={sigRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && uploadSignature(e.target.files[0])} />
            {d.signatureFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${d.signatureFileId}?inline=1`} alt="Подпись" className="mb-2 h-16 rounded border border-line bg-white object-contain p-1" />
            ) : null}
            <button className="btn btn-secondary w-full" onClick={() => sigRef.current?.click()}>{d.signatureFileId ? "Заменить" : "Загрузить"}</button>
          </Field>
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={reset} error={error} saved={saved} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { fmtDate } from "@/core/format";
import { d } from "@/core/calc/decimal";
import type { CalcSettings } from "@/core/calc/types";
import { Field, SaveBar } from "@/components/ui/Field";
import { useDraft } from "@/components/ui/useDraft";
import { Badge, KV, Notice, PageHeader, PageSkeleton, Panel, toast } from "@/components/ui/kit";
import { WEIGHT_METHODS } from "@/core/calc/weights";

interface Edition { id: string; name: string; edition: string; isDemo: boolean; isActive: boolean }
interface Resp {
  settings: { defaultAdjustmentSourceId?: string | null };
  effective: { calc: CalcSettings; defaultAdjustmentSourceId: string | null };
  account: { email: string; name: string | null; plan: string; createdAt: string };
}

const pctOf = (share: string) => d(share).mul(100).toString();
const shareOf = (pct: string) => {
  const n = Number(String(pct).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? d(n).div(100).toString() : null;
};

export function SettingsView() {
  const [data, setData] = useState<Resp | null>(null);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([api.get<Resp>("/api/settings"), api.get<Edition[]>("/api/directory")])
      .then(([s, e]) => { setData(s); setEditions(e); })
      .catch((e) => setError(errorText(e)));
  }, []);
  if (error) return <Notice tone="err">{error}</Notice>;
  if (!data) return <PageSkeleton />;
  return <Inner data={data} editions={editions} />;
}

function Inner({ data, editions }: { data: Resp; editions: Edition[] }) {
  const c = data.effective.calc;
  const init = {
    defaultAdjustmentSourceId: data.effective.defaultAdjustmentSourceId ?? "",
    adjustmentMode: c.adjustmentMode,
    weightMethod: c.weightMethod === "manual" ? "inverse_gross" : c.weightMethod,
    roundingStep: c.roundingStep,
    weightDecimals: String(c.weightDecimals),
    cvThreshold: pctOf(c.cvThreshold),
    grossAdjustmentThreshold: pctOf(c.grossAdjustmentThreshold),
  };
  const { draft: f, set, dirty, reset } = useDraft(init as Record<string, unknown>);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const cv = shareOf(String(f.cvThreshold));
    const gross = shareOf(String(f.grossAdjustmentThreshold));
    if (!cv || !gross) return setErr("Пороги — в процентах от 0 до 100");
    setBusy(true);
    setErr(null);
    try {
      await api.put("/api/settings", {
        defaultAdjustmentSourceId: f.defaultAdjustmentSourceId || null,
        calc: {
          adjustmentMode: f.adjustmentMode,
          weightMethod: f.weightMethod,
          roundingStep: f.roundingStep,
          weightDecimals: Number(f.weightDecimals),
          cvThreshold: cv,
          grossAdjustmentThreshold: gross,
        },
      });
      toast("Настройки сохранены");
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  const sel = (k: string, opts: Array<[string, string]>) => (
    <select className="input" value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value)}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Настройки" description="Системные параметры аккаунта. Сведения об оценщике — в разделе «Профиль оценщика»." />
      <div className="space-y-4">
        <Panel title="Новые оценки по умолчанию" description="Применяются при создании оценки. В существующих оценках параметры меняются на вкладках «Корректировки» и «Расчёт».">
          <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
            <Field label="Справочник корректировок" className="md:col-span-2" hint="Если не выбран — берётся последняя активная редакция, собственная в приоритете перед демонстрационной">
              <select className="input" value={String(f.defaultAdjustmentSourceId ?? "")} onChange={(e) => set("defaultAdjustmentSourceId", e.target.value)}>
                <option value="">Автоматически</option>
                {editions.filter((e) => e.isActive).map((e) => <option key={e.id} value={e.id}>{e.name} — ред. {e.edition}{e.isDemo ? " (демо)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Порядок применения корректировок">{sel("adjustmentMode", [["sequential", "Последовательно (мультипликативно)"], ["staged", "1-я группа последовательно, 2-я — суммой"]])}</Field>
            <Field label="Метод расчёта весов">{sel("weightMethod", (["inverse_gross", "linear_gross", "equal"] as const).map((m) => [m, `${WEIGHT_METHODS[m].label}: ${WEIGHT_METHODS[m].formula}`]))}</Field>
            <Field label="Округление итоговой стоимости">{sel("roundingStep", [["0", "Без округления"], ["100", "До 100 ₽"], ["1000", "До 1 000 ₽"], ["10000", "До 10 000 ₽"], ["100000", "До 100 000 ₽"]])}</Field>
            <Field label="Точность весов">{sel("weightDecimals", [["2", "2 знака"], ["3", "3 знака"], ["4", "4 знака"], ["5", "5 знаков"], ["6", "6 знаков"]])}</Field>
          </div>
        </Panel>

        <Panel title="Пороги контроля" description="Превышение порогов показывается предупреждением в проверках и не блокирует отчёт">
          <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
            <Field label="Коэффициент вариации скорректированных цен" hint="Выше порога — выборка аналогов считается неоднородной">
              <div className="relative"><input className="input num pr-8" inputMode="decimal" value={String(f.cvThreshold ?? "")} onChange={(e) => set("cvThreshold", e.target.value)} /><span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span></div>
            </Field>
            <Field label="Суммарная корректировка аналога, Σ|корр|" hint="Выше порога — аналог требует внимания">
              <div className="relative"><input className="input num pr-8" inputMode="decimal" value={String(f.grossAdjustmentThreshold ?? "")} onChange={(e) => set("grossAdjustmentThreshold", e.target.value)} /><span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span></div>
            </Field>
          </div>
        </Panel>

        <Panel title="Аккаунт">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KV label="Email для входа">{data.account.email}</KV>
            <KV label="Доступ"><Badge tone="brand">Ранний доступ · бесплатно</Badge></KV>
            <KV label="Аккаунт создан">{fmtDate(data.account.createdAt)}</KV>
            <KV label="Данные оценщика"><Link href="/app/profile" className="text-brand hover:underline">Профиль оценщика →</Link></KV>
          </div>
          <p className="mt-4 text-[12.5px] text-muted">Оплата подписки будет подключена позже — сейчас все функции доступны без ограничений.</p>
        </Panel>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={reset} error={err} />
    </div>
  );
}

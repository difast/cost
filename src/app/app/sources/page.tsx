import { listSources } from "@/server/integrations/registry";

export const metadata = { title: "Источники данных" };

const ACCESS: Record<string, string> = { official_api: "Официальный API", partner_api: "Партнёрский API", licensed_data: "Лицензированный поставщик", user_import: "Загрузка пользователем", manual: "Ручной ввод" };
const CAP: Record<string, string> = { property: "объект", building: "здание", comparables: "аналоги", market: "рынок", infrastructure: "инфраструктура", address: "адреса" };

export default function Page() {
  const sources = listSources();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Источники данных</h1>
        <p className="text-muted">Сервис использует только легальные каналы получения данных. Новые источники подключаются как адаптеры — без изменения расчётного ядра.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Источник</th><th>Канал доступа</th><th>Данные</th><th>Статус</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.code}>
                <td className="font-medium">{s.name}{s.note && <div className="text-xs font-normal text-muted">{s.note}</div>}</td>
                <td>{ACCESS[s.access]}</td>
                <td className="text-xs">{s.capabilities.map((c) => CAP[c]).join(", ")}</td>
                <td>{s.configured ? <span className="badge bg-green-50 text-ok">подключён</span> : <span className="badge bg-zinc-100 text-zinc-500">планируется</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

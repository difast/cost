"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";

export function AcceptInvite({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn btn-primary w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.post(`/api/invitations/${encodeURIComponent(token)}`, {});
            location.href = "/app";
          } catch (e) {
            setError(errorText(e));
            setBusy(false);
          }
        }}
      >
        {busy ? "Подождите…" : "Принять приглашение"}
      </button>
      {error && <p className="mt-2 text-[13px] text-err" role="alert">{error}</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export function useDraft<T extends Record<string, unknown>>(initial: T) {
  const [base, setBase] = useState<T>(initial);
  const [draft, setDraft] = useState<T>(initial);
  useEffect(() => {
    setBase(initial);
    setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)]);
  const set = useCallback((k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v })), []);
  const dirty = useMemo(() => JSON.stringify(base) !== JSON.stringify(draft), [base, draft]);
  /** Только изменённые поля. */
  const changes = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(draft)) if (JSON.stringify(draft[k]) !== JSON.stringify(base[k])) out[k] = draft[k] === "" ? null : draft[k];
    return out;
  }, [base, draft]);
  return { draft, set, dirty, changes, reset: () => setDraft(base) };
}

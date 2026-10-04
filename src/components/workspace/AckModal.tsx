"use client";

// Подтверждение действия при наличии замечаний: проверки не блокируют работу,
// но оценщик явно видит ошибки и подтверждает, что продолжает с ними.

import { ApiError } from "@/lib/api";
import type { CheckIssue } from "@/core/checks";
import { Modal } from "@/components/ui/kit";

export interface AckRequest { title: string; message: string; issues: CheckIssue[]; run: () => void }

/** Ошибка сервера «нужно подтверждение» → список замечаний. */
export function needsAck(e: unknown): CheckIssue[] | null {
  if (!(e instanceof ApiError) || e.status !== 409) return null;
  const d = e.details as { needsAck?: boolean; issues?: CheckIssue[] } | undefined;
  return d?.needsAck ? d.issues ?? [] : null;
}

export function AckModal({ req, onClose }: { req: AckRequest | null; onClose: () => void }) {
  return (
    <Modal
      open={!!req}
      onClose={onClose}
      size="md"
      title={req?.title ?? ""}
      description={req?.message}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Вернуться к исправлению</button>
          <button className="btn btn-primary" onClick={() => { const r = req; onClose(); r?.run(); }}>Продолжить с замечаниями</button>
        </>
      }
    >
      <ul className="max-h-72 space-y-1 overflow-y-auto text-[13px] text-zinc-700">
        {req?.issues.map((i, k) => <li key={k} className="flex gap-2"><span className="text-err">•</span>{i.message}</li>)}
      </ul>
    </Modal>
  );
}

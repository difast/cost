import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { CalcError } from "@/core/calc/engine";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const notFound = (what = "Объект") => new HttpError(404, `${what} не найден`);

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Обёртка обработчика API: единый формат ошибок. */
export function api<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: "Некорректные данные", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 400 },
        );
      }
      if (e instanceof CalcError) return NextResponse.json({ error: e.message }, { status: 422 });
      console.error(e);
      return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Ожидается JSON");
  }
  return schema.parse(raw);
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Next 15: params — Promise. */
export type Params<T extends string> = { params: Promise<Record<T, string>> };

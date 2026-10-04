import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** Проверка состояния для хостинга: приложение запущено и БД доступна. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503 });
  }
}

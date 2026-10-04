import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, ok, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { ensureSystemData } from "@/server/bootstrap";

export const GET = api(async (req) => {
  await requireUser();
  await ensureSystemData();
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const kind = sp.get("kind") ?? undefined;
  const docs = await prisma.normativeDocument.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
              { tags: { has: q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: [{ kind: "asc" }, { code: "asc" }],
    select: { id: true, kind: true, code: true, title: true, issuer: true, adoptedAt: true, effectiveFrom: true, status: true, url: true, summary: true, tags: true, revision: true, updatedAt: true },
  });
  return ok(docs);
});

const schema = z.object({
  kind: z.enum(["law", "fso", "sro_standard", "methodology", "court", "literature"]),
  code: z.string().max(100).optional(),
  title: z.string().min(3).max(1000),
  issuer: z.string().max(500).optional(),
  url: z.string().url().optional(),
  summary: z.string().max(5000).optional(),
  body: z.string().max(2_000_000).optional(),
  tags: z.array(z.string()).default([]),
  licenseNote: z.string().max(2000).optional(),
});

export const POST = api(async (req) => {
  const u = await requireUser();
  if (u.role !== "admin") throw new HttpError(403, "Пополнение библиотеки доступно администратору");
  const data = await body(req, schema);
  return ok(await prisma.normativeDocument.create({ data: { ...data, tags: data.tags.map((t) => t.toLowerCase()) } }), 201);
});

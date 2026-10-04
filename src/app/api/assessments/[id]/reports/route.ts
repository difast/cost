import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { generateReport, regenerateFromVersion } from "@/server/services/report";

export const maxDuration = 60;

const schema = z.object({
  formats: z.array(z.enum(["docx", "pdf"])).min(1).default(["docx", "pdf"]),
  versionId: z.string().optional(),
});

export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, schema);
  const reports = data.versionId
    ? await regenerateFromVersion(id, data.versionId, u.id, data.formats)
    : await generateReport(id, u.id, data.formats);
  return ok(reports, 201);
});

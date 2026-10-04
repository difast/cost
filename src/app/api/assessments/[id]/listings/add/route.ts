import { z } from "zod";
import { api, body, ok, type Params } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getOwned } from "@/server/services/assessment";
import { addListingToAssessment } from "@/server/services/listings";

const schema = z.object({ searchId: z.string().min(1), externalId: z.string().min(1).max(200), status: z.enum(["use", "review"]).default("review") });

export const POST = api(async (req, { params }: Params<"id">) => {
  const u = await requireUser();
  const { id } = await params;
  await getOwned(id, u.id);
  const data = await body(req, schema);
  const c = await addListingToAssessment(id, u.id, data.searchId, data.externalId, data.status);
  return ok({ id: c.id }, 201);
});

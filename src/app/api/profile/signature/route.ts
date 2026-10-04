import { api, ok, HttpError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { storeFile } from "@/server/services/files";

export const POST = api(async (req) => {
  const u = await requireUser();
  const form = await req.formData();
  const f = form.get("file");
  if (!(f instanceof File)) throw new HttpError(400, "Файл не передан");
  if (!["image/png", "image/jpeg"].includes(f.type)) throw new HttpError(415, "Подпись — PNG или JPEG");
  const stored = await storeFile({ ownerId: u.id, kind: "signature", filename: f.name, mime: f.type, data: Buffer.from(await f.arrayBuffer()) });
  return ok(stored, 201);
});

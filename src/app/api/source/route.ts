import { fetchUrlSource, pdfToSource, textToSource } from "@/lib/server/fetchSource";
import { fail, fromError, ok, readBody } from "@/lib/server/http";
import { rateLimit, tooLarge } from "@/lib/server/rateLimit";
import { SourceJsonBody } from "@/lib/validate";

export const maxDuration = 30;

/**
 * Add a source. Accepts JSON ({ id, url, fallbackText? } or { id, text, title,
 * date, isAiAnswer }) or multipart form data with a PDF file.
 */
export async function POST(req: Request) {
  const limited = tooLarge(req, 7 * 1024 * 1024) ?? rateLimit(req, "fetch");
  if (limited) return limited;
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const id = String(form.get("id") ?? "s0").slice(0, 12);
      if (!(file instanceof File)) return fail("Choose a PDF file to upload.");
      if (file.size > 6 * 1024 * 1024) return fail("That file is too large (limit 6 MB).", 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf = new TextDecoder("latin1").decode(bytes.slice(0, 5)) === "%PDF-";
      if (!isPdf) return fail("Only PDF files can be uploaded.", 415);
      return ok({ source: await pdfToSource(bytes, id, file.name) });
    }
    const body = await readBody(req, SourceJsonBody);
    if (body.text) {
      return ok({ source: textToSource({ id: body.id, title: body.title ?? "", text: body.text, date: body.date, isAiAnswer: body.isAiAnswer, url: body.url }) });
    }
    if (body.url) {
      const fallback = body.fallbackText ? { text: body.fallbackText, title: body.fallbackTitle, date: body.fallbackDate } : undefined;
      return ok({ source: await fetchUrlSource(body.url, body.id, fallback) });
    }
    return fail("Add a link, paste some text, or upload a PDF.");
  } catch (e) {
    return fromError(e);
  }
}

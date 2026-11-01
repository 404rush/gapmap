import { z } from "zod";
import { firstIssue } from "../validate";
import { FetchError } from "./fetchSource";
import { LlmError } from "./llm";

export function ok(data: unknown) {
  return Response.json(data);
}

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Turn any thrown error into a clear JSON error response. */
export function fromError(e: unknown) {
  if (e instanceof FetchError || e instanceof LlmError) return fail(e.message, e.status);
  if (e instanceof z.ZodError) return fail(firstIssue(e), 400);
  console.error(e);
  return fail("Something went wrong on the server. Try again.", 500);
}

/** Parse and validate a JSON body. */
export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new FetchError("Request body must be JSON.", 400, "input");
  }
  return schema.parse(raw);
}

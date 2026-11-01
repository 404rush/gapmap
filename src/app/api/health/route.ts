import { connection } from "next/server";
import { llmLabel } from "@/lib/server/llm";
import { searchEnabled } from "@/lib/server/search";

export async function GET() {
  await connection(); // read env at request time, not build time
  return Response.json({ ai: llmLabel(), search: searchEnabled() });
}

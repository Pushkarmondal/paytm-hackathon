/**
 * Optional live adapter. OFF unless CLAIM_SACH_LLM_PROVIDER=anthropic and
 * ANTHROPIC_API_KEY are set. Receives public clause text only; returns
 * proposals that the browser verifies verbatim and a person confirms.
 * This route is implemented but has NOT been exercised against the API in
 * this build (no key was configured).
 */

import { buildPrompt, parseProposalsResponse } from "@/ai";
import { clauseSchema } from "@/ingestion/schemas";
import { z } from "zod";

const bodySchema = z.object({ clauses: z.array(clauseSchema).min(1).max(200) });

export async function POST(request: Request): Promise<Response> {
  if (process.env.CLAIM_SACH_LLM_PROVIDER !== "anthropic" || !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The live adapter is off. Set CLAIM_SACH_LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY to enable it. Cached proposals remain available." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body with clauses." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Expected { clauses: Clause[] }." }, { status: 400 });

  const model = process.env.CLAIM_SACH_LLM_MODEL ?? "claude-sonnet-5-5";
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: buildPrompt(parsed.data.clauses) }] }),
  });
  if (!upstream.ok) return Response.json({ error: `The model request failed (${upstream.status}).` }, { status: 502 });
  const data = (await upstream.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
  const proposals = parseProposalsResponse(text);
  if (!proposals.ok) return Response.json({ error: proposals.error }, { status: 502 });
  const producedOn = new Date().toISOString().slice(0, 10);
  return Response.json({ proposals: proposals.value.map((p) => ({ ...p, provenance: { provider: "claude-live", model, producedOn, note: "Live proposal from the Anthropic API; public clause text only was sent." } })) });
}

/**
 * Deterministic clause retrieval: tf-idf cosine over clause titles and text,
 * with a small synonym table. No model, no network. Used to point a reviewer
 * at the clause that most likely answers a question; never to decide anything.
 */

import type { Clause } from "@/engine/types";

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "is", "are", "be", "for", "and", "or", "as", "at", "by", "with", "this", "that",
  "which", "what", "when", "does", "do", "it", "its", "shall", "if", "than", "from", "into", "their", "there", "who", "how",
  "much", "can", "will", "where", "these", "those", "was", "were", "has", "have", "had", "any", "all", "under", "between",
  "not", "no", "am", "i", "my", "me", "part", "clause",
]);

const SYNONYMS: Record<string, string[]> = {
  icu: ["intensive", "care", "unit"],
  intensive: ["icu"],
  deduction: ["proportion", "proportionate"],
  deducted: ["deduction", "proportion"],
  proportionate: ["proportion"],
  definition: ["mean"],
  count: ["mean", "include"],
  defined: ["mean"],
  cap: ["liability", "exceed"],
  maximum: ["liability", "exceed"],
  most: ["liability", "exceed", "total"],
  cover: ["payable", "include"],
  covered: ["payable", "include"],
  subject: ["include"],
  differently: ["differential", "billing"],
  entitled: ["payable", "limit"],
  entitlement: ["payable", "limit"],
  percentage: ["sum", "insured"],
  percent: ["sum", "insured"],
};

const TITLE_WEIGHT = 3;

function fold(token: string): string {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is")) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(fold);
}

function expand(tokens: string[]): string[] {
  const out = [...tokens];
  for (const t of tokens) {
    for (const s of SYNONYMS[t] ?? []) out.push(fold(s));
  }
  return out;
}

function termFrequencies(tokens: string[], weight = 1): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + weight);
  return tf;
}

export interface RetrievalHit {
  clauseId: string;
  score: number;
}

export function retrieveClauses(query: string, clauses: readonly Clause[], limit = 3): RetrievalHit[] {
  const docs = clauses.map((c) => {
    const tf = termFrequencies(tokenize(c.text));
    for (const [t, w] of termFrequencies(tokenize(c.title), TITLE_WEIGHT)) tf.set(t, (tf.get(t) ?? 0) + w);
    return { clauseId: c.id, tf };
  });
  const n = docs.length;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;

  const q = termFrequencies(expand(tokenize(query)));
  const qNorm = Math.sqrt([...q.entries()].reduce((acc, [t, w]) => acc + (w * idf(t)) ** 2, 0));
  if (qNorm === 0) return [];

  const hits: RetrievalHit[] = [];
  for (const d of docs) {
    let dot = 0;
    let dNorm = 0;
    for (const [t, w] of d.tf) {
      const wd = w * idf(t);
      dNorm += wd * wd;
      const wq = q.get(t);
      if (wq) dot += wq * idf(t) * wd;
    }
    if (dot > 0) hits.push({ clauseId: d.clauseId, score: dot / (qNorm * Math.sqrt(dNorm)) });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

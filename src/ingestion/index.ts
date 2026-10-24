/**
 * Document ingestion adapters. They turn files into the engine's typed inputs,
 * or into a clear error. They never compute money, never throw, and never
 * send anything anywhere: callers run them in the browser.
 */

import type { ZodError, ZodType } from "zod";
import { paise, type Money } from "@/engine/money";
import type { BillCategory, BillItem, HospitalEstimate, PolicyRuleset, PolicySchedule, SourceRef } from "@/engine/types";
import { billCategorySchema, estimateSchema, rulesetSchema, scheduleSchema } from "./schemas";

export type IngestionErrorCode = "MALFORMED_JSON" | "SCHEMA" | "EVIDENCE" | "MALFORMED_CSV" | "EMPTY" | "TOO_LARGE" | "UNSUPPORTED_TYPE" | "UNEXPECTED";

export interface IngestionError {
  code: IngestionErrorCode;
  message: string;
}

export type Parsed<T> = { ok: true; value: T; provenance: "upload"; warnings: string[] } | { ok: false; error: IngestionError };

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function fail<T>(code: IngestionErrorCode, message: string): Parsed<T> {
  return { ok: false, error: { code, message } };
}

function succeed<T>(value: T, warnings: string[] = []): Parsed<T> {
  return { ok: true, value, provenance: "upload", warnings };
}

function schemaMessage(error: ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

function parseJson<T>(text: string, schema: ZodType<T>): Parsed<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return fail("MALFORMED_JSON", `The file is not valid JSON: ${e instanceof Error ? e.message : "parse error"}`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return fail("SCHEMA", `The file does not match the expected shape. ${schemaMessage(result.error)}`);
  }
  return succeed(result.data);
}

function checkEvidence(ruleset: PolicyRuleset): string | null {
  const refs: { name: string; source: SourceRef }[] = [];
  const r = ruleset.rules;
  if (r.roomLimit) refs.push({ name: "roomLimit", source: r.roomLimit.source });
  if (r.icuLimit) refs.push({ name: "icuLimit", source: r.icuLimit.source });
  if (r.proportionateDeduction) refs.push({ name: "proportionateDeduction", source: r.proportionateDeduction.source });
  if (r.itemClasses) refs.push({ name: "itemClasses", source: r.itemClasses.source });
  if (r.sumInsuredCap) refs.push({ name: "sumInsuredCap", source: r.sumInsuredCap.source });
  if (r.roomUnavailabilityClause) refs.push({ name: "roomUnavailabilityClause", source: r.roomUnavailabilityClause.source });
  for (const { name, source } of refs) {
    const clause = ruleset.clauses.find((c) => c.id === source.clauseId);
    if (!clause) return `rules.${name} cites clause ${source.clauseId}, which is not in the wording`;
    if (clause.text !== source.quotedText) return `rules.${name} quotes text that differs from clause ${source.clauseId}`;
    if (clause.page !== source.page) return `rules.${name} cites page ${source.page}, but clause ${source.clauseId} is on page ${clause.page}`;
  }
  return null;
}

export function parseRulesetJson(text: string): Parsed<PolicyRuleset> {
  const parsed = parseJson(text, rulesetSchema);
  if (!parsed.ok) return parsed;
  const ruleset = parsed.value as PolicyRuleset;
  const problem = checkEvidence(ruleset);
  if (problem) return fail("EVIDENCE", `Evidence check failed: ${problem}. Every rule must quote its clause exactly.`);
  return succeed(ruleset);
}

export function parseScheduleJson(text: string): Parsed<PolicySchedule> {
  const parsed = parseJson(text, scheduleSchema);
  if (!parsed.ok) return parsed;
  return succeed({ ...(parsed.value as Omit<PolicySchedule, "provenance">), provenance: "upload" });
}

export function parseEstimateJson(text: string): Parsed<HospitalEstimate> {
  const parsed = parseJson(text, estimateSchema);
  if (!parsed.ok) return parsed;
  return succeed({ ...(parsed.value as Omit<HospitalEstimate, "provenance">), provenance: "upload" });
}

export interface EstimateLines {
  items: BillItem[];
}

const RUPEES = /^(\d+)(?:\.(\d{1,2}))?$/;

function rupeesToPaise(text: string): Money | null {
  const m = RUPEES.exec(text.trim());
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  if (!Number.isSafeInteger(whole * 100 + frac)) return null;
  return paise(whole * 100 + frac);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Line items from a CSV with columns label, category, amount_rupees and optionally days, rate_per_day_rupees. */
export function parseEstimateCsv(text: string): Parsed<EstimateLines> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return fail("EMPTY", "The file is empty.");
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iLabel = col("label");
  const iCategory = col("category");
  const iAmount = col("amount_rupees");
  const iDays = col("days");
  const iRate = col("rate_per_day_rupees");
  if (iLabel < 0 || iCategory < 0 || iAmount < 0) {
    return fail("MALFORMED_CSV", "The first line must be a header with the columns label, category and amount_rupees (days and rate_per_day_rupees are optional).");
  }
  if (lines.length === 1) return fail("EMPTY", "The file has a header but no line items.");

  const items: BillItem[] = [];
  const warnings: string[] = [];
  for (let n = 1; n < lines.length; n++) {
    const cells = splitCsvLine(lines[n]);
    const lineNo = n + 1;
    const label = cells[iLabel] ?? "";
    if (!label) return fail("MALFORMED_CSV", `line ${lineNo}: the label is empty.`);
    const amount = rupeesToPaise(cells[iAmount] ?? "");
    if (amount === null) return fail("MALFORMED_CSV", `line ${lineNo}: "${cells[iAmount] ?? ""}" is not an amount in rupees (digits, at most two decimal places).`);
    const rawCategory = cells[iCategory] ?? "";
    const categoryParse = billCategorySchema.safeParse(rawCategory);
    let category: BillCategory;
    if (categoryParse.success) {
      category = categoryParse.data;
    } else {
      category = "other";
      warnings.push(`line ${lineNo}: unknown category "${rawCategory}" for "${label}" was mapped to "other"; classify it on Input review.`);
    }
    const item: BillItem = { itemId: `line-${n}`, label, category, amount };
    const daysText = iDays >= 0 ? (cells[iDays] ?? "") : "";
    const rateText = iRate >= 0 ? (cells[iRate] ?? "") : "";
    if (daysText || rateText) {
      const days = Number(daysText);
      const rate = rupeesToPaise(rateText);
      if (!Number.isInteger(days) || days < 0 || rate === null) {
        return fail("MALFORMED_CSV", `line ${lineNo}: days must be a whole number and rate_per_day_rupees an amount in rupees when either is given.`);
      }
      item.perDay = { days, ratePerDay: rate };
    }
    items.push(item);
  }
  return succeed({ items }, warnings);
}

export type UploadKind = "ruleset" | "schedule" | "estimate";

export interface UploadFile {
  name: string;
  size: number;
  text: string;
}

export type UploadResult =
  | { ok: true; kind: "ruleset"; value: PolicyRuleset; warnings: string[] }
  | { ok: true; kind: "schedule"; value: PolicySchedule; warnings: string[] }
  | { ok: true; kind: "estimate"; value: HospitalEstimate; warnings: string[] }
  | { ok: true; kind: "estimateItems"; value: EstimateLines; warnings: string[] }
  | { ok: false; error: IngestionError };

function extension(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** The single entry point for files. Checks size and type by extension, then routes to a parser. Never throws. */
export function readUpload(file: UploadFile, expected: UploadKind): UploadResult {
  try {
    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: { code: "TOO_LARGE", message: `The file is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` } };
    }
    const ext = extension(file.name);
    if (ext === "csv") {
      if (expected !== "estimate") {
        return { ok: false, error: { code: "UNSUPPORTED_TYPE", message: "A CSV can only carry hospital estimate line items. Policy wordings and schedules are JSON." } };
      }
      const r = parseEstimateCsv(file.text);
      return r.ok ? { ok: true, kind: "estimateItems", value: r.value, warnings: r.warnings } : r;
    }
    if (ext !== "json") {
      return { ok: false, error: { code: "UNSUPPORTED_TYPE", message: `".${ext || "?"}" files are not supported. Use a Claim Sach ruleset, schedule or estimate JSON, or a CSV of estimate line items.` } };
    }
    switch (expected) {
      case "ruleset": {
        const r = parseRulesetJson(file.text);
        return r.ok ? { ok: true, kind: "ruleset", value: r.value, warnings: r.warnings } : r;
      }
      case "schedule": {
        const r = parseScheduleJson(file.text);
        return r.ok ? { ok: true, kind: "schedule", value: r.value, warnings: r.warnings } : r;
      }
      case "estimate": {
        const r = parseEstimateJson(file.text);
        return r.ok ? { ok: true, kind: "estimate", value: r.value, warnings: r.warnings } : r;
      }
    }
  } catch (e) {
    return { ok: false, error: { code: "UNEXPECTED", message: `The file could not be processed: ${e instanceof Error ? e.message : "unknown error"}` } };
  }
}

import { z } from "zod";

const money = z.number().refine((n) => Number.isSafeInteger(n), { message: "Money must be an integer number of paise" });
const nonNegativeMoney = money.refine((n) => n >= 0, { message: "Money must not be negative" });

export const provenanceSchema = z.enum(["fixture", "upload", "userConfirmed", "userEntered"]);

export const sourceRefSchema = z.object({
  documentId: z.string().min(1),
  documentTitle: z.string().min(1),
  version: z.string().min(1),
  page: z.number().int().min(0),
  clauseId: z.string().min(1),
  quotedText: z.string().min(1),
});

export const clauseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  page: z.number().int().min(0),
  text: z.string().min(1),
});

export const issuerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("synthetic"), label: z.string().min(1) }),
  z.object({ kind: z.literal("insurer"), name: z.string().min(1), uin: z.string().min(1).optional(), sourceUrl: z.url() }),
]);

export const billCategorySchema = z.enum([
  "roomRent",
  "icu",
  "nursing",
  "surgeonFees",
  "anaesthetistFees",
  "consultantFees",
  "operationTheatre",
  "implant",
  "pharmacyConsumables",
  "diagnostics",
  "physiotherapy",
  "hospitalAdmin",
  "other",
]);

const limitBasisSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("percentOfSumInsuredPerDay"), percent: z.number().min(0).max(100), capPerDay: nonNegativeMoney.optional() }),
  z.object({ kind: z.literal("fixedPerDay"), amount: nonNegativeMoney }),
  z.object({ kind: z.literal("scheduleDefined") }),
]);

const uncertaintyCodeSchema = z.enum([
  "SCHEDULE_MISSING",
  "SCHEDULE_CONTRADICTS_WORDING",
  "DIFFERENTIAL_BILLING_NOT_ESTABLISHED",
  "ITEM_NOT_CLASSIFIED",
  "WORDING_SILENT_ON_ROOM_UNAVAILABILITY",
  "RULE_ABSENT",
  "LIMIT_RULE_ABSENT",
  "ICU_RATE_NOT_STATED",
  "RATIO_AMBIGUOUS_ROOM_AND_ICU",
  "WORDING_PREDATES_2020_NORMS",
  "POLICY_CAVEAT",
]);

const caveatSchema = z.object({
  code: uncertaintyCodeSchema,
  text: z.string().min(1),
  affectedCategories: z.array(billCategorySchema).min(1),
  resolvableBy: z.enum(["user", "hospital", "insurer", "none"]),
  whatWouldResolveIt: z.string().min(1),
});

const limitRuleSchema = z.object({
  ruleId: z.string().min(1),
  appliesTo: z.enum(["room", "icu"]),
  basis: limitBasisSchema,
  source: sourceRefSchema,
});

const conditionSchema = z.object({
  conditionId: z.literal("hospitalFollowsDifferentialBilling"),
  description: z.string().min(1),
  resolvableBy: z.enum(["user", "hospital", "insurer", "none"]),
});

export const rulesetSchema = z.object({
  schemaVersion: z.string().min(1),
  fixtureVersion: z.string().min(1),
  metadata: z.object({
    policyId: z.string().min(1),
    name: z.string().min(1),
    issuer: issuerSchema,
    wordingVersion: z.string().min(1),
    effectiveDate: z.string().min(1),
    sourceDocument: z.object({ documentId: z.string().min(1), title: z.string().min(1), url: z.url().optional() }),
    verification: z
      .object({
        url: z.url(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        fetchedOn: z.string().min(1),
        pages: z.number().int().min(1),
        extractedWith: z.string().min(1),
        encodedClauses: z.array(z.string().min(1)),
        note: z.string().min(1),
      })
      .optional(),
  }),
  clauses: z.array(clauseSchema).min(1),
  rules: z.object({
    roomLimit: limitRuleSchema.optional(),
    icuLimit: limitRuleSchema.optional(),
    proportionateDeduction: z
      .object({
        ruleId: z.string().min(1),
        affectedClass: z.literal("associatedMedicalExpenses"),
        conditions: z.array(conditionSchema),
        triggers: z.array(z.enum(["room", "icu"])).min(1).optional(),
        source: sourceRefSchema,
      })
      .optional(),
    itemClasses: z
      .object({
        ruleId: z.string().min(1),
        included: z.array(billCategorySchema),
        excluded: z.array(billCategorySchema),
        notes: z.partialRecord(billCategorySchema, z.string().min(1)).optional(),
        source: sourceRefSchema,
      })
      .optional(),
    sumInsuredCap: z.object({ ruleId: z.string().min(1), source: sourceRefSchema }).optional(),
    roomUnavailabilityClause: z.object({ ruleId: z.string().min(1), source: sourceRefSchema }).optional(),
    copay: z.object({ ruleId: z.string().min(1), percent: z.number().min(0).max(100), source: sourceRefSchema }).optional(),
  }),
  caveats: z.array(caveatSchema).optional(),
  notices: z.array(caveatSchema).optional(),
});

const statedLimitSchema = z.object({ amountPerDay: nonNegativeMoney, source: sourceRefSchema });

export const scheduleSchema = z.object({
  scheduleId: z.string().min(1),
  policyId: z.string().min(1),
  sumInsured: nonNegativeMoney,
  insuredLabel: z.string().min(1),
  policyPeriod: z.object({ from: z.string().min(1), to: z.string().min(1) }),
  roomLimitPerDay: statedLimitSchema.optional(),
  icuLimitPerDay: statedLimitSchema.optional(),
  provenance: provenanceSchema.optional(),
});

export const billItemSchema = z.object({
  itemId: z.string().min(1),
  label: z.string().min(1),
  category: billCategorySchema,
  amount: nonNegativeMoney,
  perDay: z.object({ days: z.number().int().min(0), ratePerDay: nonNegativeMoney }).optional(),
});

export const estimateSchema = z
  .object({
    estimateId: z.string().min(1),
    hospitalLabel: z.string().min(1),
    procedureLabel: z.string().min(1),
    roomDays: z.number().int().min(0).max(365),
    roomOptions: z.array(z.object({ roomId: z.string().min(1), label: z.string().min(1), ratePerDay: nonNegativeMoney })).min(1),
    items: z.array(billItemSchema),
    differentialBilling: z.enum(["yes", "no", "notStated"]),
    provenance: provenanceSchema.optional(),
  })
  .refine((e) => new Set(e.items.map((i) => i.itemId)).size === e.items.length, { message: "Item ids must be unique", path: ["items"] })
  .refine((e) => new Set(e.roomOptions.map((r) => r.roomId)).size === e.roomOptions.length, { message: "Room ids must be unique", path: ["roomOptions"] });

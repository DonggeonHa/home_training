import { z } from "zod"
import { assertNever } from "./assert-never"
import {
  type AppState,
  CATEGORY_IDS,
  type CategoryId,
  type MetricRule,
  type SafetyClearance,
  SCHEMA_VERSION,
  type SessionId,
  type SetRecord,
} from "./contracts"

const CATEGORY_ID_VALUES: readonly string[] = CATEGORY_IDS

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isCategoryId = (value: unknown): value is CategoryId =>
  typeof value === "string" && CATEGORY_ID_VALUES.includes(value)

const isSessionId = (value: unknown): value is SessionId =>
  typeof value === "string" && UUID_PATTERN.test(value)

const integerCount = z.number().int().nonnegative()
const positiveInteger = z.number().int().positive()
const lateralitySchema = z.union([z.literal("none"), z.literal("perSide")])

const RirGateSchema = z
  .object({
    min: z.number().int().min(0).max(5),
    max: z.number().int().min(0).max(5),
  })
  .strict()
  .refine((gate) => gate.max >= gate.min, {
    message: "RIR max must be greater than or equal to min",
  })

const SetQualitySchema = z
  .object({
    pain: z.boolean(),
    form: z.union([z.literal("good"), z.literal("limited"), z.literal("failed")]),
    rom: z.union([z.literal("full"), z.literal("partial"), z.literal("failed")]),
  })
  .strict()

export const CategoryIdSchema = z.custom<CategoryId>(isCategoryId, {
  message: "Unknown category ID",
})

export const SessionIdSchema = z.custom<SessionId>(isSessionId, {
  message: "Session ID must be a UUID",
})

const RepsMetricRuleSchema = z
  .object({
    kind: z.literal("reps"),
    min: positiveInteger,
    max: positiveInteger,
    sets: z.literal(3),
    laterality: lateralitySchema,
    rir: RirGateSchema.optional(),
  })
  .strict()
  .refine((rule) => rule.max >= rule.min, {
    message: "Rep max must be greater than or equal to min",
  })

const DurationMetricRuleSchema = z
  .object({
    kind: z.literal("duration"),
    minSeconds: positiveInteger,
    maxSeconds: positiveInteger,
    sets: z.literal(3),
    laterality: lateralitySchema,
  })
  .strict()
  .refine((rule) => rule.maxSeconds >= rule.minSeconds, {
    message: "Duration max must be greater than or equal to min",
  })

const TempoRepsMetricRuleSchema = z
  .object({
    kind: z.literal("tempoReps"),
    reps: positiveInteger,
    tempoSeconds: positiveInteger,
    sets: z.literal(3),
    laterality: lateralitySchema,
  })
  .strict()

const TerminalMetricRuleSchema = z
  .object({
    kind: z.literal("terminal"),
    label: z.string().min(1),
    laterality: lateralitySchema,
  })
  .strict()

export const MetricRuleSchema: z.ZodType<MetricRule> = z.discriminatedUnion("kind", [
  RepsMetricRuleSchema,
  DurationMetricRuleSchema,
  TempoRepsMetricRuleSchema,
  TerminalMetricRuleSchema,
])

export const SetRecordSchema: z.ZodType<SetRecord> = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("single"),
      value: integerCount,
      rir: z.number().int().min(0).max(5).optional(),
      loadKg: z.number().nonnegative().optional(),
      quality: SetQualitySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("perSide"),
      left: integerCount,
      right: integerCount,
      rir: z.number().int().min(0).max(5).optional(),
      loadKg: z.number().nonnegative().optional(),
      quality: SetQualitySchema,
    })
    .strict(),
])

const CategoryProgressSchema = z
  .object({
    categoryId: CategoryIdSchema,
    level: z.number().int().nonnegative(),
    status: z.union([
      z.literal("unassessed"),
      z.literal("provisional"),
      z.literal("active"),
      z.literal("testUnlocked"),
    ]),
    qualifiedSessionIds: z.array(SessionIdSchema).readonly().optional(),
  })
  .strict()

export const SessionEntrySchema = z
  .object({
    categoryId: CategoryIdSchema,
    level: z.number().int().nonnegative(),
    exerciseName: z.string().min(1),
    metricRule: MetricRuleSchema,
    sets: z.array(SetRecordSchema).readonly(),
  })
  .strict()
  .superRefine((entry, context) => {
    for (const [index, set] of entry.sets.entries()) {
      switch (entry.metricRule.laterality) {
        case "none":
          if (set.kind !== "single") {
            context.addIssue({
              code: "custom",
              path: ["sets", index, "kind"],
              message: "Metric laterality none requires single set records",
            })
          }
          break
        case "perSide":
          if (set.kind !== "perSide") {
            context.addIssue({
              code: "custom",
              path: ["sets", index, "kind"],
              message: "Metric laterality perSide requires perSide set records",
            })
          }
          break
        default:
          assertNever(entry.metricRule.laterality)
      }
    }
  })

const CompletedSessionSchema = z
  .object({
    id: SessionIdSchema,
    routineId: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
    completedAt: z.string().datetime({ offset: true }),
    entries: z.array(SessionEntrySchema).readonly(),
  })
  .strict()

export const SafetyClearanceSchema: z.ZodType<SafetyClearance> = z
  .object({
    cleared: z.boolean(),
    clearedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()

export const AppStateSchema: z.ZodType<AppState> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    safety: SafetyClearanceSchema,
    nextRoutine: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
    progress: z
      .object({
        push: CategoryProgressSchema,
        pull: CategoryProgressSchema,
        squat: CategoryProgressSchema,
        hinge: CategoryProgressSchema,
        verticalPush: CategoryProgressSchema,
        core: CategoryProgressSchema,
      })
      .strict(),
    completedSessions: z.array(CompletedSessionSchema).readonly(),
  })
  .strict()

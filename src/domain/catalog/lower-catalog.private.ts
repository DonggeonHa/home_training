import { z } from "zod"
import { GLOBAL_SAFETY_STOP_SIGNALS } from "../content/common"
import type { ExerciseCategory, ExerciseLevel } from "../contracts"
import { MetricRuleSchema } from "../schemas"

export type CatalogLevel = ExerciseLevel & {
  readonly targetLabel: string
  readonly assessmentEligible: boolean
  readonly promotable: boolean
  readonly equipment: readonly string[]
  readonly regressions: readonly string[]
}

export type CatalogCategory = Omit<ExerciseCategory, "levels"> & {
  readonly instructions: readonly string[]
  readonly mistakes: readonly string[]
  readonly stopSignals: readonly string[]
  readonly levels: readonly CatalogLevel[]
}

export const PROGRESSION_RIR = { min: 1, max: 2 } as const
export const STOP_SIGNALS = GLOBAL_SAFETY_STOP_SIGNALS

export function defineCatalogCategory(category: CatalogCategory): CatalogCategory {
  return category
}

const NonEmptyTextListSchema = z.array(z.string().min(1)).min(1).readonly()

const CatalogLevelSchema = z
  .object({
    level: z.number().int().nonnegative(),
    name: z.string().min(1),
    targetLabel: z.string().min(1),
    metricRule: MetricRuleSchema,
    restSeconds: z.number().int().positive(),
    assessmentEligible: z.boolean(),
    promotable: z.boolean(),
    equipment: NonEmptyTextListSchema,
    regressions: NonEmptyTextListSchema,
    instructions: NonEmptyTextListSchema,
    mistakes: NonEmptyTextListSchema,
    safety: NonEmptyTextListSchema,
  })
  .strict()
  .superRefine((level, context) => {
    if (level.metricRule.kind === "reps" && level.metricRule.rir === undefined) {
      context.addIssue({
        code: "custom",
        path: ["metricRule", "rir"],
        message: "Repetition targets require an RIR gate",
      })
    }

    if (level.metricRule.kind === "terminal" && level.promotable) {
      context.addIssue({
        code: "custom",
        path: ["promotable"],
        message: "Terminal targets cannot be promotable",
      })
    }
  })

export function isCatalogLevelValid(level: unknown): boolean {
  return CatalogLevelSchema.safeParse(level).success
}

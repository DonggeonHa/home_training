import { assertNever } from "../assert-never"
import type { CategoryId, ExerciseLevel, MetricRule, RirGate } from "../contracts"

export type AssessmentPolicy = {
  readonly eligible: boolean
  readonly requiresDoorframeBarChecklist?: boolean | undefined
  readonly rir?: RirGate | undefined
}

export type UpperBodyExerciseLevel = ExerciseLevel & {
  readonly key: string
  readonly targetLabel: string
  readonly equipment: readonly string[]
  readonly regression: string
  readonly assessment: AssessmentPolicy
}

export type UpperBodyCatalog = {
  readonly id: CategoryId
  readonly title: string
  readonly muscles: readonly string[]
  readonly longTermGoal: string
  readonly warmup: readonly string[]
  readonly instructions: readonly string[]
  readonly mistakes: readonly string[]
  readonly stopSignals: readonly string[]
  readonly levels: readonly UpperBodyExerciseLevel[]
  readonly expectedLevelRange: {
    readonly first: 0
    readonly last: number
  }
  readonly doorframeBarChecklist?: readonly string[] | undefined
}

export type UpperBodyCatalogValidationResult =
  | { readonly kind: "valid" }
  | {
      readonly kind: "invalid"
      readonly reason:
        | "duplicate-level"
        | "missing-level"
        | "empty-required-content"
        | "empty-equipment-or-regression"
        | "missing-doorframe-checklist"
        | "missing-doorframe-assessment-gate"
    }

const RIR_GATE = { min: 1, max: 2 } as const

export const repsRule = (
  min: number,
  max: number,
  laterality: MetricRule["laterality"],
): MetricRule => ({
  kind: "reps",
  min,
  max,
  sets: 3,
  laterality,
  rir: RIR_GATE,
})

export const durationRule = (minSeconds: number, maxSeconds: number): MetricRule => ({
  kind: "duration",
  minSeconds,
  maxSeconds,
  sets: 3,
  laterality: "none",
})

export const tempoRepsRule = (min: number, max: number, tempoSeconds: number): MetricRule => ({
  kind: "tempoReps",
  min,
  max,
  tempoSeconds,
  sets: 3,
  laterality: "none",
})

export function formatUpperBodyTargetLabel(rule: MetricRule): string {
  switch (rule.kind) {
    case "reps": {
      const reps = rule.min === rule.max ? `${rule.min}회` : `${rule.min}~${rule.max}회`
      const prefix = rule.laterality === "perSide" ? "좌우 " : ""
      return `${prefix}${reps} × ${rule.sets}세트`
    }
    case "duration": {
      const seconds =
        rule.minSeconds === rule.maxSeconds
          ? `${rule.minSeconds}초`
          : `${rule.minSeconds}~${rule.maxSeconds}초`
      return `${seconds} × ${rule.sets}세트`
    }
    case "tempoReps": {
      const reps = rule.min === rule.max ? `${rule.min}회` : `${rule.min}~${rule.max}회`
      return `${rule.tempoSeconds}초 하강 × ${reps} × ${rule.sets}세트`
    }
    case "terminal":
      return rule.label
    default:
      return assertNever(rule)
  }
}

export function validateUpperBodyCatalog(
  catalog: UpperBodyCatalog,
): UpperBodyCatalogValidationResult {
  const levels = catalog.levels.map((level) => level.level)
  const levelSet = new Set(levels)

  if (levelSet.size !== levels.length) {
    return { kind: "invalid", reason: "duplicate-level" }
  }

  for (
    let expectedLevel = catalog.expectedLevelRange.first;
    expectedLevel <= catalog.expectedLevelRange.last;
    expectedLevel += 1
  ) {
    if (!levelSet.has(expectedLevel)) {
      return { kind: "invalid", reason: "missing-level" }
    }
  }

  if (
    catalog.muscles.length === 0 ||
    catalog.warmup.length === 0 ||
    catalog.instructions.length === 0 ||
    catalog.mistakes.length === 0 ||
    catalog.stopSignals.length === 0
  ) {
    return { kind: "invalid", reason: "empty-required-content" }
  }

  if (
    catalog.levels.some((level) => level.equipment.length === 0 || level.regression.length === 0)
  ) {
    return { kind: "invalid", reason: "empty-equipment-or-regression" }
  }

  if (
    catalog.id === "pull" &&
    (!catalog.doorframeBarChecklist || catalog.doorframeBarChecklist.length === 0)
  ) {
    return { kind: "invalid", reason: "missing-doorframe-checklist" }
  }

  if (
    catalog.id === "pull" &&
    catalog.levels.some(
      (level) =>
        level.assessment.eligible && level.assessment.requiresDoorframeBarChecklist !== true,
    )
  ) {
    return { kind: "invalid", reason: "missing-doorframe-assessment-gate" }
  }

  return { kind: "valid" }
}

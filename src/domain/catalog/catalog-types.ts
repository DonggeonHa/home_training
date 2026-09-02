import type { CategoryId, ExerciseLevel, Laterality, RirGate } from "../contracts"

export const CATALOG_VALIDATION_ERROR_KINDS = [
  "category-order-mismatch",
  "duplicate-category-id",
  "unknown-category-id",
  "duplicate-level",
  "out-of-range-level",
  "missing-level",
  "invalid-level-id",
  "duplicate-level-key",
  "empty-required-content",
  "empty-level-content",
  "missing-computable-gate",
  "terminal-promotable",
  "unexpected-terminal",
  "missing-terminal",
  "free-hspu-must-be-terminal",
  "invalid-set-count",
  "unknown-metric-rule",
] as const

export type CatalogLevel = ExerciseLevel & {
  readonly id: string
  readonly categoryId: CategoryId
  readonly key: string
  readonly targetLabel: string
  readonly assessmentEligible: boolean
  readonly promotable: boolean
  readonly equipment: readonly string[]
  readonly regressions: readonly string[]
}

export type CatalogCategory = {
  readonly id: CategoryId
  readonly title: string
  readonly muscles: readonly string[]
  readonly warmup: readonly string[]
  readonly instructions: readonly string[]
  readonly mistakes: readonly string[]
  readonly stopSignals: readonly string[]
  readonly levels: readonly CatalogLevel[]
  readonly doorframeBarChecklist?: readonly string[] | undefined
}

export type CatalogValidationLevel = Omit<CatalogLevel, "categoryId" | "metricRule"> & {
  readonly categoryId: string
  readonly metricRule: CatalogValidationMetricRule
}

export type CatalogValidationCategory = Omit<CatalogCategory, "id" | "levels"> & {
  readonly id: string
  readonly levels: readonly CatalogValidationLevel[]
}

export type CatalogLookupResult =
  | { readonly kind: "found"; readonly category: CatalogCategory }
  | { readonly kind: "notFound"; readonly id: string }

export type CatalogValidationMetricRule =
  | {
      readonly kind: "reps"
      readonly min: number
      readonly max: number
      readonly sets: number
      readonly laterality: Laterality
      readonly rir?: RirGate | undefined
    }
  | {
      readonly kind: "duration"
      readonly minSeconds: number
      readonly maxSeconds: number
      readonly sets: number
      readonly laterality: Laterality
    }
  | {
      readonly kind: "tempoReps"
      readonly min: number
      readonly max: number
      readonly tempoSeconds: number
      readonly sets: number
      readonly laterality: Laterality
      readonly rir?: RirGate | undefined
    }
  | {
      readonly kind: "terminal"
      readonly label: string
      readonly laterality: Laterality
    }
  | {
      readonly kind: "unknownMetricRule"
    }

export type CatalogValidationError =
  | { readonly kind: "category-order-mismatch"; readonly expected: readonly string[] }
  | { readonly kind: "duplicate-category-id"; readonly categoryId: string }
  | { readonly kind: "unknown-category-id"; readonly categoryId: string }
  | { readonly kind: "duplicate-level"; readonly categoryId: string; readonly level: number }
  | { readonly kind: "out-of-range-level"; readonly categoryId: string; readonly level: number }
  | { readonly kind: "missing-level"; readonly categoryId: string; readonly level: number }
  | { readonly kind: "invalid-level-id"; readonly categoryId: string; readonly level: number }
  | {
      readonly kind: "duplicate-level-key"
      readonly key: string
      readonly firstCategoryId: string
      readonly secondCategoryId: string
    }
  | { readonly kind: "empty-required-content"; readonly categoryId: string }
  | { readonly kind: "empty-level-content"; readonly categoryId: string; readonly level: number }
  | {
      readonly kind: "missing-computable-gate"
      readonly categoryId: string
      readonly level: number
    }
  | { readonly kind: "terminal-promotable"; readonly categoryId: string; readonly level: number }
  | { readonly kind: "unexpected-terminal"; readonly categoryId: string; readonly level: number }
  | { readonly kind: "missing-terminal"; readonly categoryId: string; readonly level: number }
  | { readonly kind: "free-hspu-must-be-terminal" }
  | { readonly kind: "invalid-set-count"; readonly categoryId: string; readonly level: number }
  | { readonly kind: "unknown-metric-rule"; readonly categoryId: string; readonly level: number }

export type CatalogValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly error: CatalogValidationError }

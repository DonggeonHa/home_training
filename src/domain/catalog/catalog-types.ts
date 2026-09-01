import type { CategoryId, ExerciseLevel } from "../contracts"

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

export type CatalogValidationLevel = Omit<CatalogLevel, "categoryId"> & {
  readonly categoryId: string
}

export type CatalogValidationCategory = Omit<CatalogCategory, "id" | "levels"> & {
  readonly id: string
  readonly levels: readonly CatalogValidationLevel[]
}

export type CatalogLookupResult =
  | { readonly kind: "found"; readonly category: CatalogCategory }
  | { readonly kind: "notFound"; readonly id: string }

export type CatalogValidationError =
  | { readonly kind: "category-order-mismatch"; readonly expected: readonly string[] }
  | { readonly kind: "duplicate-category-id"; readonly categoryId: string }
  | { readonly kind: "unknown-category-id"; readonly categoryId: string }
  | { readonly kind: "duplicate-level"; readonly categoryId: string; readonly level: number }
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

export type CatalogValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly error: CatalogValidationError }

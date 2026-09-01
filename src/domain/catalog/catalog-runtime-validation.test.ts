import { describe, expect, it } from "vitest"
import {
  type CatalogValidationCategory,
  type CatalogValidationMetricRule,
  EXERCISE_CATALOG,
  validateCatalog,
} from "./index"

function cloneCatalogWithCategory(
  category: CatalogValidationCategory,
): readonly CatalogValidationCategory[] {
  return EXERCISE_CATALOG.map((existingCategory) =>
    existingCategory.id === category.id ? category : existingCategory,
  )
}

function categoryWithMetricRule(
  category: CatalogValidationCategory,
  levelNumber: number,
  metricRule: CatalogValidationMetricRule,
): CatalogValidationCategory {
  return {
    ...category,
    levels: category.levels.map((level) =>
      level.level === levelNumber ? { ...level, metricRule } : level,
    ),
  }
}

describe("catalog runtime validation", () => {
  it("rejects every non-terminal metric kind when runtime set count is not three", () => {
    const repsRule: CatalogValidationMetricRule = {
      kind: "reps",
      min: 10,
      max: 10,
      sets: 2,
      laterality: "none",
      rir: { min: 1, max: 2 },
    }
    const durationRule: CatalogValidationMetricRule = {
      kind: "duration",
      minSeconds: 20,
      maxSeconds: 30,
      sets: 2,
      laterality: "none",
    }
    const tempoRule: CatalogValidationMetricRule = {
      kind: "tempoReps",
      min: 5,
      max: 5,
      tempoSeconds: 5,
      sets: 2,
      laterality: "none",
    }

    const results = [
      validateCatalog(
        cloneCatalogWithCategory(categoryWithMetricRule(EXERCISE_CATALOG[0], 0, repsRule)),
      ),
      validateCatalog(
        cloneCatalogWithCategory(categoryWithMetricRule(EXERCISE_CATALOG[1], 0, durationRule)),
      ),
      validateCatalog(
        cloneCatalogWithCategory(categoryWithMetricRule(EXERCISE_CATALOG[1], 4, tempoRule)),
      ),
    ]

    expect(results).toEqual([
      { kind: "invalid", error: { kind: "invalid-set-count", categoryId: "push", level: 0 } },
      { kind: "invalid", error: { kind: "invalid-set-count", categoryId: "pull", level: 0 } },
      { kind: "invalid", error: { kind: "invalid-set-count", categoryId: "pull", level: 4 } },
    ])
  })
})

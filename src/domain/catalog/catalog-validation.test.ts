import { describe, expect, it } from "vitest"
import type { MetricRule } from "../contracts"
import { CATEGORY_IDS } from "../contracts"
import {
  type CatalogValidationCategory,
  type CatalogValidationMetricRule,
  EXERCISE_CATALOG,
  validateCatalog,
} from "./index"

const oneSecondDurationRule: CatalogValidationMetricRule = {
  kind: "duration",
  minSeconds: 1,
  maxSeconds: 1,
  sets: 3,
  laterality: "none",
}

const unexpectedTerminalRule: CatalogValidationMetricRule = {
  kind: "terminal",
  label: "끝",
  laterality: "none",
}

function cloneCatalogWithCategory(
  category: CatalogValidationCategory,
): readonly CatalogValidationCategory[] {
  return EXERCISE_CATALOG.map((existingCategory) =>
    existingCategory.id === category.id ? category : existingCategory,
  )
}

function replaceCatalogCategoryAt(
  index: number,
  category: CatalogValidationCategory,
): readonly CatalogValidationCategory[] {
  return EXERCISE_CATALOG.map((existingCategory, existingIndex) =>
    existingIndex === index ? category : existingCategory,
  )
}

type MetricReplacement = {
  readonly category: CatalogValidationCategory
  readonly level: number
  readonly metricRule: CatalogValidationMetricRule
  readonly name?: string | undefined
}

function categoryWithMetricRule(replacement: MetricReplacement): CatalogValidationCategory {
  return {
    ...replacement.category,
    levels: replacement.category.levels.map((level) =>
      level.level === replacement.level
        ? {
            ...level,
            name: replacement.name ?? level.name,
            metricRule: replacement.metricRule,
          }
        : level,
    ),
  }
}

describe("catalog validation malformed fixtures", () => {
  it("rejects duplicate, missing, unknown, content, gate, and terminal fixtures", () => {
    const duplicateCategory = { ...EXERCISE_CATALOG[0], id: "pull" }
    const missingLevelCategory = {
      ...EXERCISE_CATALOG[1],
      levels: EXERCISE_CATALOG[1].levels.filter((level) => level.level !== 2),
    }
    const duplicateKeyCategory = {
      ...EXERCISE_CATALOG[2],
      levels: EXERCISE_CATALOG[2].levels.map((level) =>
        level.level === 1
          ? { ...level, key: EXERCISE_CATALOG[2].levels[0]?.key ?? "missing" }
          : level,
      ),
    }
    const unknownCategory = { ...EXERCISE_CATALOG[3], id: "unknown" }
    const emptyRequiredContentCategory = { ...EXERCISE_CATALOG[4], warmup: [] }
    const repsRuleWithoutRir: MetricRule = {
      kind: "reps",
      min: 10,
      max: 10,
      sets: 3,
      laterality: "none",
    }
    const missingGateCategory = {
      ...EXERCISE_CATALOG[5],
      levels: EXERCISE_CATALOG[5].levels.map((level) =>
        level.level === 0 ? { ...level, metricRule: repsRuleWithoutRir } : level,
      ),
    }
    const promotedTerminalCategory = {
      ...EXERCISE_CATALOG[4],
      levels: EXERCISE_CATALOG[4].levels.map((level) =>
        level.metricRule.kind === "terminal" ? { ...level, promotable: true } : level,
      ),
    }
    const nonTerminalFreeHspuCategory = categoryWithMetricRule({
      category: EXERCISE_CATALOG[4],
      level: 8,
      metricRule: oneSecondDurationRule,
    })
    const otherTerminalCategory = categoryWithMetricRule({
      category: EXERCISE_CATALOG[5],
      level: 7,
      metricRule: unexpectedTerminalRule,
    })

    const results = [
      validateCatalog(replaceCatalogCategoryAt(0, duplicateCategory)),
      validateCatalog(cloneCatalogWithCategory(missingLevelCategory)),
      validateCatalog(cloneCatalogWithCategory(duplicateKeyCategory)),
      validateCatalog(replaceCatalogCategoryAt(3, unknownCategory)),
      validateCatalog(cloneCatalogWithCategory(emptyRequiredContentCategory)),
      validateCatalog(cloneCatalogWithCategory(missingGateCategory)),
      validateCatalog(cloneCatalogWithCategory(promotedTerminalCategory)),
      validateCatalog(cloneCatalogWithCategory(nonTerminalFreeHspuCategory)),
      validateCatalog(cloneCatalogWithCategory(otherTerminalCategory)),
    ]

    expect(results).toEqual([
      { kind: "invalid", error: { kind: "duplicate-category-id", categoryId: "pull" } },
      { kind: "invalid", error: { kind: "missing-level", categoryId: "pull", level: 2 } },
      {
        kind: "invalid",
        error: {
          kind: "duplicate-level-key",
          key: "squat-0-의자 스쿼트",
          firstCategoryId: "squat",
          secondCategoryId: "squat",
        },
      },
      { kind: "invalid", error: { kind: "unknown-category-id", categoryId: "unknown" } },
      { kind: "invalid", error: { kind: "empty-required-content", categoryId: "verticalPush" } },
      { kind: "invalid", error: { kind: "missing-computable-gate", categoryId: "core", level: 0 } },
      {
        kind: "invalid",
        error: { kind: "terminal-promotable", categoryId: "verticalPush", level: 8 },
      },
      { kind: "invalid", error: { kind: "free-hspu-must-be-terminal" } },
      { kind: "invalid", error: { kind: "unexpected-terminal", categoryId: "core", level: 7 } },
    ])
  })

  it("rejects order, level identity, empty level content, missing terminal, and unknown metrics", () => {
    const swappedOrderCatalog = [
      EXERCISE_CATALOG[1],
      EXERCISE_CATALOG[0],
      ...EXERCISE_CATALOG.slice(2),
    ]
    const duplicateLevelCategory = {
      ...EXERCISE_CATALOG[0],
      levels: EXERCISE_CATALOG[0].levels.map((level) =>
        level.level === 1
          ? { ...level, id: "push-0", level: 0, key: "push-duplicate-level" }
          : level,
      ),
    }
    const invalidLevelIdCategory = {
      ...EXERCISE_CATALOG[0],
      levels: EXERCISE_CATALOG[0].levels.map((level) =>
        level.level === 0 ? { ...level, id: "push-wrong" } : level,
      ),
    }
    const emptyLevelContentCategory = {
      ...EXERCISE_CATALOG[0],
      levels: EXERCISE_CATALOG[0].levels.map((level) =>
        level.level === 0 ? { ...level, equipment: [] } : level,
      ),
    }
    const missingTerminalCategory = categoryWithMetricRule({
      category: EXERCISE_CATALOG[4],
      level: 8,
      name: "고급 목표",
      metricRule: oneSecondDurationRule,
    })
    const unknownMetricCategory = categoryWithMetricRule({
      category: EXERCISE_CATALOG[0],
      level: 0,
      metricRule: { kind: "unknownMetricRule" },
    })

    const results = [
      validateCatalog(swappedOrderCatalog),
      validateCatalog(cloneCatalogWithCategory(duplicateLevelCategory)),
      validateCatalog(cloneCatalogWithCategory(invalidLevelIdCategory)),
      validateCatalog(cloneCatalogWithCategory(emptyLevelContentCategory)),
      validateCatalog(cloneCatalogWithCategory(missingTerminalCategory)),
      validateCatalog(cloneCatalogWithCategory(unknownMetricCategory)),
    ]

    expect(results).toEqual([
      { kind: "invalid", error: { kind: "category-order-mismatch", expected: CATEGORY_IDS } },
      { kind: "invalid", error: { kind: "duplicate-level", categoryId: "push", level: 0 } },
      { kind: "invalid", error: { kind: "invalid-level-id", categoryId: "push", level: 0 } },
      { kind: "invalid", error: { kind: "empty-level-content", categoryId: "push", level: 0 } },
      {
        kind: "invalid",
        error: { kind: "missing-terminal", categoryId: "verticalPush", level: 8 },
      },
      { kind: "invalid", error: { kind: "unknown-metric-rule", categoryId: "push", level: 0 } },
    ])
  })

  it("throws on impossible validation metric variants outside the validation union", () => {
    const impossibleMetricCategory = {
      ...EXERCISE_CATALOG[0],
      levels: EXERCISE_CATALOG[0].levels.map((level) =>
        level.level === 0
          ? {
              ...level,
              metricRule: JSON.parse('{"kind":"impossible","sets":3,"laterality":"none"}'),
            }
          : level,
      ),
    }

    expect(() => validateCatalog(cloneCatalogWithCategory(impossibleMetricCategory))).toThrow(
      "Unexpected domain variant",
    )
  })
})

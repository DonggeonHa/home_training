import { assertNever } from "../assert-never"
import type { MetricRule } from "../contracts"
import type { CatalogCategory, CatalogLookupResult } from "./catalog-types"
import { validateCatalog } from "./catalog-validation"
import { core } from "./core"
import { hinge } from "./hinge"
import type { CatalogCategory as LowerCatalogCategory } from "./lower-catalog.private"
import { PULL_CATEGORY } from "./pull"
import { PUSH_CATEGORY } from "./push"
import { squat } from "./squat"
import type { UpperBodyCatalog } from "./upper-body"
import { verticalPush } from "./vertical-push"

export type {
  CatalogCategory,
  CatalogLevel,
  CatalogLookupResult,
  CatalogValidationCategory,
  CatalogValidationError,
  CatalogValidationLevel,
  CatalogValidationMetricRule,
  CatalogValidationResult,
} from "./catalog-types"
export { CATALOG_VALIDATION_ERROR_KINDS } from "./catalog-types"
export { validateCatalog }

function normalizeUpperBodyCategory(category: UpperBodyCatalog): CatalogCategory {
  return {
    id: category.id,
    title: category.title,
    muscles: category.muscles,
    warmup: category.warmup,
    instructions: category.instructions,
    mistakes: category.mistakes,
    stopSignals: category.stopSignals,
    doorframeBarChecklist: category.doorframeBarChecklist,
    levels: category.levels.map((level) => ({
      id: `${category.id}-${level.level}`,
      categoryId: category.id,
      level: level.level,
      key: level.key,
      name: level.name,
      metricRule: level.metricRule,
      targetLabel: level.targetLabel,
      restSeconds: level.restSeconds,
      assessmentEligible: level.assessment.eligible,
      promotable: level.metricRule.kind !== "terminal",
      equipment: level.equipment,
      regressions: [level.regression],
      instructions: category.instructions,
      mistakes: category.mistakes,
      safety: category.stopSignals,
    })),
  }
}

function normalizeLowerCategory(category: LowerCatalogCategory): CatalogCategory {
  return {
    id: category.id,
    title: category.title,
    muscles: category.muscles,
    warmup: category.warmup,
    instructions: category.instructions,
    mistakes: category.mistakes,
    stopSignals: category.stopSignals,
    levels: category.levels.map((level) => ({
      id: `${category.id}-${level.level}`,
      categoryId: category.id,
      level: level.level,
      key: `${category.id}-${level.level}-${level.name}`,
      name: level.name,
      metricRule: level.metricRule,
      targetLabel: level.targetLabel,
      restSeconds: level.restSeconds,
      assessmentEligible: level.assessmentEligible,
      promotable: level.promotable,
      equipment: level.equipment,
      regressions: level.regressions,
      instructions: level.instructions,
      mistakes: level.mistakes,
      safety: level.safety,
    })),
  }
}

export const EXERCISE_CATALOG = [
  normalizeUpperBodyCategory(PUSH_CATEGORY),
  normalizeUpperBodyCategory(PULL_CATEGORY),
  normalizeLowerCategory(squat),
  normalizeLowerCategory(hinge),
  normalizeLowerCategory(verticalPush),
  normalizeLowerCategory(core),
] as const satisfies readonly CatalogCategory[]

export function findCatalogCategory(id: string): CatalogLookupResult {
  const category = EXERCISE_CATALOG.find((catalogCategory) => catalogCategory.id === id)
  return category === undefined ? { kind: "notFound", id } : { kind: "found", category }
}

export function formatTargetLabel(rule: MetricRule): string {
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
      const prefix = rule.laterality === "perSide" ? "좌우 " : ""
      return `${prefix}${seconds} × ${rule.sets}세트`
    }
    case "tempoReps": {
      const reps = rule.min === rule.max ? `${rule.min}회` : `${rule.min}~${rule.max}회`
      const prefix = rule.laterality === "perSide" ? "좌우 " : ""
      return `${prefix}${rule.tempoSeconds}초 하강 × ${reps} × ${rule.sets}세트`
    }
    case "terminal":
      return rule.label
    default:
      return assertNever(rule)
  }
}

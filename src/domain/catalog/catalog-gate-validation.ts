import { assertNever } from "../assert-never"
import type {
  CatalogValidationCategory,
  CatalogValidationLevel,
  CatalogValidationResult,
} from "./catalog-types"

export const TERMINAL_LEVEL = {
  categoryId: "verticalPush",
  level: 8,
  name: "프리 HSPU",
} as const

export function validateLevelGate(
  categoryId: string,
  level: CatalogValidationLevel,
): CatalogValidationResult {
  switch (level.metricRule.kind) {
    case "reps":
      if (level.metricRule.sets !== 3) {
        return invalidSetCount(categoryId, level)
      }
      if (level.metricRule.rir === undefined) {
        return {
          kind: "invalid",
          error: { kind: "missing-computable-gate", categoryId, level: level.level },
        }
      }
      return { kind: "valid" }
    case "duration":
    case "tempoReps":
      if (level.metricRule.sets !== 3) {
        return invalidSetCount(categoryId, level)
      }
      return { kind: "valid" }
    case "terminal":
      return validateTerminalLevel(categoryId, level)
    case "unknownMetricRule":
      return {
        kind: "invalid",
        error: { kind: "unknown-metric-rule", categoryId, level: level.level },
      }
    default:
      return assertNever(level.metricRule)
  }
}

export function hasNonTerminalFreeHspu(catalog: readonly CatalogValidationCategory[]): boolean {
  return catalog.some(
    (category) =>
      category.id === TERMINAL_LEVEL.categoryId &&
      category.levels.some(
        (level) =>
          level.level === TERMINAL_LEVEL.level &&
          level.name === TERMINAL_LEVEL.name &&
          level.metricRule.kind !== "terminal",
      ),
  )
}

function validateTerminalLevel(
  categoryId: string,
  level: CatalogValidationLevel,
): CatalogValidationResult {
  if (
    categoryId !== TERMINAL_LEVEL.categoryId ||
    level.level !== TERMINAL_LEVEL.level ||
    level.name !== TERMINAL_LEVEL.name
  ) {
    return {
      kind: "invalid",
      error: { kind: "unexpected-terminal", categoryId, level: level.level },
    }
  }
  if (level.promotable) {
    return {
      kind: "invalid",
      error: { kind: "terminal-promotable", categoryId, level: level.level },
    }
  }
  return { kind: "valid" }
}

function invalidSetCount(
  categoryId: string,
  level: CatalogValidationLevel,
): CatalogValidationResult {
  return {
    kind: "invalid",
    error: { kind: "invalid-set-count", categoryId, level: level.level },
  }
}

import { assertNever } from "../assert-never"
import type { CategoryId } from "../contracts"
import { CATEGORY_IDS } from "../contracts"
import type {
  CatalogValidationCategory,
  CatalogValidationLevel,
  CatalogValidationResult,
} from "./catalog-types"

const EXPECTED_LEVEL_COUNTS = {
  push: 8,
  pull: 9,
  squat: 9,
  hinge: 8,
  verticalPush: 9,
  core: 8,
} as const satisfies Record<(typeof CATEGORY_IDS)[number], number>

const TERMINAL_LEVEL = {
  categoryId: "verticalPush",
  level: 8,
  name: "프리 HSPU",
} as const

export function validateCatalog(
  catalog: readonly CatalogValidationCategory[],
): CatalogValidationResult {
  const categoryOrderResult = validateCategoryOrder(catalog)
  if (categoryOrderResult.kind === "invalid") {
    return categoryOrderResult
  }

  const levelKeyOwners = new Map<string, string>()
  let terminalFound = false

  for (const category of catalog) {
    const categoryResult = validateCategory(category, levelKeyOwners)
    if (categoryResult.kind === "invalid") {
      return categoryResult
    }

    for (const level of category.levels) {
      if (level.metricRule.kind === "terminal") {
        terminalFound = true
      }
    }
  }

  if (!terminalFound) {
    return {
      kind: "invalid",
      error: {
        kind: "missing-terminal",
        categoryId: TERMINAL_LEVEL.categoryId,
        level: TERMINAL_LEVEL.level,
      },
    }
  }

  return { kind: "valid" }
}

function validateCategoryOrder(
  catalog: readonly CatalogValidationCategory[],
): CatalogValidationResult {
  const seenCategoryIds = new Set<string>()

  for (const category of catalog) {
    if (seenCategoryIds.has(category.id)) {
      return { kind: "invalid", error: { kind: "duplicate-category-id", categoryId: category.id } }
    }
    seenCategoryIds.add(category.id)
  }

  for (const category of catalog) {
    if (!isExpectedCategoryId(category.id)) {
      return { kind: "invalid", error: { kind: "unknown-category-id", categoryId: category.id } }
    }
  }

  if (
    catalog.length !== CATEGORY_IDS.length ||
    catalog.some((category, index) => category.id !== CATEGORY_IDS[index])
  ) {
    return { kind: "invalid", error: { kind: "category-order-mismatch", expected: CATEGORY_IDS } }
  }

  return { kind: "valid" }
}

function validateCategory(
  category: CatalogValidationCategory,
  levelKeyOwners: Map<string, string>,
): CatalogValidationResult {
  if (
    category.muscles.length === 0 ||
    category.warmup.length === 0 ||
    category.instructions.length === 0 ||
    category.mistakes.length === 0 ||
    category.stopSignals.length === 0
  ) {
    return { kind: "invalid", error: { kind: "empty-required-content", categoryId: category.id } }
  }

  return validateLevels(category, levelKeyOwners)
}

function validateLevels(
  category: CatalogValidationCategory,
  levelKeyOwners: Map<string, string>,
): CatalogValidationResult {
  const seenLevels = new Set<number>()
  const expectedLevelCount = getExpectedLevelCount(category.id)
  if (expectedLevelCount === undefined) {
    return {
      kind: "invalid",
      error: { kind: "unknown-category-id", categoryId: category.id },
    }
  }

  for (const level of category.levels) {
    if (seenLevels.has(level.level)) {
      return {
        kind: "invalid",
        error: { kind: "duplicate-level", categoryId: category.id, level: level.level },
      }
    }
    seenLevels.add(level.level)

    const levelResult = validateLevel(category, level, levelKeyOwners)
    if (levelResult.kind === "invalid") {
      return levelResult
    }
  }

  for (let level = 0; level < expectedLevelCount; level += 1) {
    if (!seenLevels.has(level)) {
      return { kind: "invalid", error: { kind: "missing-level", categoryId: category.id, level } }
    }
  }

  return { kind: "valid" }
}

function validateLevel(
  category: CatalogValidationCategory,
  level: CatalogValidationLevel,
  levelKeyOwners: Map<string, string>,
): CatalogValidationResult {
  const structuralResult = validateLevelStructure(category, level, levelKeyOwners)
  if (structuralResult.kind === "invalid") {
    return structuralResult
  }

  return validateGate(category.id, level)
}

function validateLevelStructure(
  category: CatalogValidationCategory,
  level: CatalogValidationLevel,
  levelKeyOwners: Map<string, string>,
): CatalogValidationResult {
  if (level.id !== `${category.id}-${level.level}` || level.categoryId !== category.id) {
    return {
      kind: "invalid",
      error: { kind: "invalid-level-id", categoryId: category.id, level: level.level },
    }
  }

  const previousOwner = levelKeyOwners.get(level.key)
  if (previousOwner !== undefined) {
    return {
      kind: "invalid",
      error: {
        kind: "duplicate-level-key",
        key: level.key,
        firstCategoryId: previousOwner,
        secondCategoryId: category.id,
      },
    }
  }
  levelKeyOwners.set(level.key, category.id)

  if (
    level.equipment.length === 0 ||
    level.regressions.length === 0 ||
    level.instructions.length === 0 ||
    level.mistakes.length === 0 ||
    level.safety.length === 0
  ) {
    return {
      kind: "invalid",
      error: { kind: "empty-level-content", categoryId: category.id, level: level.level },
    }
  }

  return { kind: "valid" }
}

function validateGate(categoryId: string, level: CatalogValidationLevel): CatalogValidationResult {
  switch (level.metricRule.kind) {
    case "reps":
      if (level.metricRule.rir === undefined) {
        return {
          kind: "invalid",
          error: { kind: "missing-computable-gate", categoryId, level: level.level },
        }
      }
      return { kind: "valid" }
    case "duration":
    case "tempoReps":
      return { kind: "valid" }
    case "terminal":
      return validateTerminalLevel(categoryId, level)
    default:
      return assertNever(level.metricRule)
  }
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

function isExpectedCategoryId(id: string): id is CategoryId {
  return CATEGORY_IDS.some((categoryId) => categoryId === id)
}

function getExpectedLevelCount(categoryId: string): number | undefined {
  switch (categoryId) {
    case "push":
      return EXPECTED_LEVEL_COUNTS.push
    case "pull":
      return EXPECTED_LEVEL_COUNTS.pull
    case "squat":
      return EXPECTED_LEVEL_COUNTS.squat
    case "hinge":
      return EXPECTED_LEVEL_COUNTS.hinge
    case "verticalPush":
      return EXPECTED_LEVEL_COUNTS.verticalPush
    case "core":
      return EXPECTED_LEVEL_COUNTS.core
    default:
      return undefined
  }
}

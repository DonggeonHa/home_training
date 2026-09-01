import { assertNever } from "../../domain/assert-never"
import { EXERCISE_CATALOG } from "../../domain/catalog"
import { CATEGORY_IDS, type CategoryId } from "../../domain/contracts"
import type { AppStoreState, AssessmentStep, SafetyGate } from "./types"

export function selectSafetyGate(state: AppStoreState): SafetyGate {
  if (state.safetyBlock !== undefined) {
    return state.safetyBlock
  }

  return state.stored.safety.cleared ? { kind: "cleared" } : { kind: "needsReview" }
}

export function selectCanUseDashboard(state: AppStoreState): boolean {
  return state.stored.safety.cleared && state.stored.assessment.status === "complete"
}

export function selectAssessmentStep(state: AppStoreState): AssessmentStep {
  if (!state.stored.safety.cleared || state.safetyBlock !== undefined) {
    return { kind: "blocked" }
  }

  switch (state.stored.assessment.status) {
    case "notStarted":
      return { kind: "ready" }
    case "complete":
      return { kind: "complete" }
    case "inProgress":
      return readActiveAssessmentStep(state)
    default:
      return assertNever(state.stored.assessment.status)
  }
}

function readActiveAssessmentStep(state: AppStoreState): AssessmentStep {
  const currentCategoryId = state.stored.assessment.currentCategoryId
  const category = EXERCISE_CATALOG.find(
    (catalogCategory) => catalogCategory.id === currentCategoryId,
  )
  if (category === undefined) {
    return { kind: "complete" }
  }

  const nextLevel = state.stored.assessment.nextLevelByCategory[currentCategoryKey(category.id)]
  const eligibleLevels = category.levels.filter((level) => level.assessmentEligible)
  const level = eligibleLevels.find((eligibleLevel) => eligibleLevel.level === nextLevel)
  if (level === undefined) {
    return { kind: "complete" }
  }

  return {
    kind: "active",
    categoryId: category.id,
    categoryTitle: category.title,
    exerciseName: level.name,
    targetLabel: level.targetLabel,
    level: level.level,
    metricKind: level.metricRule.laterality === "perSide" ? "perSide" : "single",
    eligibleLevelCount: eligibleLevels.length,
  }
}

export function currentCategoryKey(
  categoryId: CategoryId,
): keyof AppStoreState["stored"]["progress"] {
  const key = CATEGORY_IDS.find((candidate) => candidate === categoryId)
  if (key === undefined) {
    throw new CategoryKeyError(categoryId)
  }
  return key
}

class CategoryKeyError extends Error {
  readonly name = "CategoryKeyError"

  constructor(readonly categoryId: CategoryId) {
    super(`unknown category key: ${categoryId}`)
  }
}

import { assertNever } from "../../domain/assert-never"
import { type CatalogCategory, type CatalogLevel, EXERCISE_CATALOG } from "../../domain/catalog"
import type { CategoryId, CategoryProgressById } from "../../domain/contracts"
import { loadStoredState } from "../../storage/persistence"
import type { StoragePort } from "../../storage/ports"
import type { AssessmentState, StoredState } from "../../storage/schemas"
import { currentCategoryKey } from "./selectors"
import type {
  AppStoreAction,
  AppStoreState,
  AssessmentSetInput,
  SafetyAnswers,
  SafetyBlock,
  SafetyBlockReason,
} from "./types"

export type CreateAppStoreInput = {
  readonly storage: StoragePort
}

export function createAppStoreState(input: CreateAppStoreInput): AppStoreState {
  const result = loadStoredState({ storage: input.storage })
  return {
    stored: result.state,
    loadNotice: result.notice,
  }
}

export function toStoredState(state: AppStoreState): StoredState {
  return state.stored
}

export function reduceAppStore(state: AppStoreState, action: AppStoreAction): AppStoreState {
  switch (action.type) {
    case "safetyAnswersSubmitted":
      return reduceSafetyAnswers(state, action.answers, action.now)
    case "safetyReviewReset":
      return { ...state, safetyBlock: undefined }
    case "assessmentStarted":
      return startAssessment(state)
    case "assessmentSetSubmitted":
      return submitAssessmentSet(state, action.categoryId, action.level, action.input)
    case "saveFailed":
      return { ...state, saveNotice: { kind: "saveFailed", reason: action.reason } }
    case "saveSucceeded":
      return { ...state, saveNotice: undefined }
    default:
      return assertNever(action)
  }
}

function reduceSafetyAnswers(
  state: AppStoreState,
  answers: SafetyAnswers,
  now: string,
): AppStoreState {
  const block = createSafetyBlock(answers)
  if (block !== null) {
    return {
      ...state,
      safetyBlock: block,
      stored: { ...state.stored, safety: { cleared: false, clearedAt: null } },
    }
  }

  return {
    ...state,
    safetyBlock: undefined,
    stored: { ...state.stored, safety: { cleared: true, clearedAt: now } },
  }
}

function createSafetyBlock(answers: SafetyAnswers): SafetyBlock | null {
  const reasons = readSafetyBlockReasons(answers)
  if (reasons.length === 0) {
    return null
  }

  return {
    kind: "blocked",
    reasons,
    urgent: reasons.includes("chestPain") || reasons.includes("faintingOrSevereDizziness"),
  }
}

function readSafetyBlockReasons(answers: SafetyAnswers): readonly SafetyBlockReason[] {
  return [
    ...(answers.chestPain ? (["chestPain"] as const) : []),
    ...(answers.faintingOrSevereDizziness ? (["faintingOrSevereDizziness"] as const) : []),
    ...(answers.unusualShortnessOfBreath ? (["unusualShortnessOfBreath"] as const) : []),
    ...(answers.cardiovascularMetabolicRenalDisease
      ? (["cardiovascularMetabolicRenalDisease"] as const)
      : []),
    ...(answers.recentInjury ? (["recentInjury"] as const) : []),
  ]
}

function startAssessment(state: AppStoreState): AppStoreState {
  if (!state.stored.safety.cleared || state.safetyBlock !== undefined) {
    return state
  }

  return {
    ...state,
    stored: {
      ...state.stored,
      assessment: {
        ...state.stored.assessment,
        status: "inProgress",
        currentCategoryId: firstCategoryId(),
      },
    },
  }
}

function submitAssessmentSet(
  state: AppStoreState,
  categoryId: CategoryId,
  level: number,
  input: AssessmentSetInput,
): AppStoreState {
  const lookup = findAssessmentLevel(categoryId, level)
  if (lookup === null || state.stored.assessment.status !== "inProgress") {
    return state
  }
  const categoryKey = currentCategoryKey(categoryId)
  if (
    state.stored.assessment.currentCategoryId !== categoryId ||
    state.stored.assessment.nextLevelByCategory[categoryKey] !== level
  ) {
    return state
  }

  return assessmentInputPasses(input, lookup.level)
    ? passAssessmentLevel(state, lookup.category, lookup.level)
    : finishAssessmentCategory(state, lookup.category.id)
}

function passAssessmentLevel(
  state: AppStoreState,
  category: CatalogCategory,
  level: CatalogLevel,
): AppStoreState {
  const categoryKey = currentCategoryKey(category.id)
  const nextEligibleLevel = category.levels.find(
    (candidate) => candidate.assessmentEligible && candidate.level > level.level,
  )
  if (nextEligibleLevel === undefined) {
    return finishAssessmentCategory(
      updateLastSafeLevel(state, category.id, level.level),
      category.id,
    )
  }

  return {
    ...state,
    stored: {
      ...state.stored,
      assessment: {
        ...updateLastSafeLevel(state, category.id, level.level).stored.assessment,
        nextLevelByCategory: {
          ...state.stored.assessment.nextLevelByCategory,
          [categoryKey]: nextEligibleLevel.level,
        },
      },
    },
  }
}

function finishAssessmentCategory(state: AppStoreState, categoryId: CategoryId): AppStoreState {
  const categoryKey = currentCategoryKey(categoryId)
  const nextCategory = findNextCategory(categoryId)
  const progress = {
    ...state.stored.progress,
    [categoryKey]: {
      categoryId,
      level: state.stored.assessment.lastSafeLevelByCategory[categoryKey],
      status: "provisional",
      qualifiedSessionIds: [],
    },
  } satisfies CategoryProgressById
  const assessment: AssessmentState = {
    ...state.stored.assessment,
    status: nextCategory === null ? "complete" : "inProgress",
    currentCategoryId: nextCategory?.id ?? null,
  }

  return { ...state, stored: { ...state.stored, progress, assessment } }
}

function updateLastSafeLevel(
  state: AppStoreState,
  categoryId: CategoryId,
  level: number,
): AppStoreState {
  const categoryKey = currentCategoryKey(categoryId)
  return {
    ...state,
    stored: {
      ...state.stored,
      assessment: {
        ...state.stored.assessment,
        lastSafeLevelByCategory: {
          ...state.stored.assessment.lastSafeLevelByCategory,
          [categoryKey]: level,
        },
      },
    },
  }
}

function assessmentInputPasses(input: AssessmentSetInput, level: CatalogLevel): boolean {
  if (input.pain || input.form !== "good" || input.rom !== "full") {
    return false
  }

  switch (level.metricRule.kind) {
    case "reps":
    case "tempoReps":
      return level.metricRule.laterality === "perSide"
        ? input.kind === "perSide" &&
            input.left >= level.metricRule.min &&
            input.right >= level.metricRule.min
        : input.kind === "single" && input.value >= level.metricRule.min
    case "duration":
      return level.metricRule.laterality === "perSide"
        ? input.kind === "perSide" &&
            input.left >= level.metricRule.minSeconds &&
            input.right >= level.metricRule.minSeconds
        : input.kind === "single" && input.value >= level.metricRule.minSeconds
    case "terminal":
      return false
    default:
      return assertNever(level.metricRule)
  }
}

function findAssessmentLevel(
  categoryId: CategoryId,
  level: number,
): { readonly category: CatalogCategory; readonly level: CatalogLevel } | null {
  const category = EXERCISE_CATALOG.find((candidate) => candidate.id === categoryId)
  const catalogLevel = category?.levels.find(
    (candidate) => candidate.level === level && candidate.assessmentEligible,
  )
  return category === undefined || catalogLevel === undefined
    ? null
    : { category, level: catalogLevel }
}

function findNextCategory(categoryId: CategoryId): CatalogCategory | null {
  const currentIndex = EXERCISE_CATALOG.findIndex((category) => category.id === categoryId)
  const nextCategory = EXERCISE_CATALOG[currentIndex + 1]
  return nextCategory ?? null
}

function firstCategoryId(): CategoryId {
  const firstCategory = EXERCISE_CATALOG[0]
  if (firstCategory === undefined) {
    throw new Error("exercise catalog is empty")
  }
  return firstCategory.id
}

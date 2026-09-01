import { assertNever } from "../../domain/assert-never"
import type { MetricRule, SetRecord } from "../../domain/contracts"
import { currentCategoryPlan, readCatalogCategory, readLevel } from "./engine"
import { replaceCurrentPlan } from "./session-state-helpers"
import type { WorkoutCategoryPlan, WorkoutState } from "./types"

export function maybeSwitchFailedFirstTestSetToCurrentLevel(state: WorkoutState): WorkoutState {
  if (state.session === null) {
    return state
  }
  const plan = currentCategoryPlan(state.session)
  const firstSet = plan.entry.sets[0]
  if (
    plan.testFallbackLevel === undefined ||
    firstSet === undefined ||
    plan.entry.sets.length !== 1 ||
    firstSetMeetsMinimum(plan, firstSet)
  ) {
    return state
  }

  const category = readCatalogCategory(plan.categoryId)
  const fallbackLevel = readLevel(category, plan.testFallbackLevel)
  return replaceCurrentPlan(state, {
    ...plan,
    entry: {
      categoryId: plan.categoryId,
      exerciseName: fallbackLevel.name,
      level: fallbackLevel.level,
      metricRule: fallbackLevel.metricRule,
      sets: [],
    },
    instructions: fallbackLevel.instructions,
    mistakes: fallbackLevel.mistakes,
    restSeconds: fallbackLevel.restSeconds,
    safety: fallbackLevel.safety,
    testAttemptEntry: plan.entry,
  })
}

function firstSetMeetsMinimum(plan: WorkoutCategoryPlan, firstSet: SetRecord): boolean {
  switch (plan.entry.metricRule.kind) {
    case "reps":
    case "tempoReps":
      return setValueMeetsMinimum(firstSet, plan.entry.metricRule, plan.entry.metricRule.min)
    case "duration":
      return setValueMeetsMinimum(firstSet, plan.entry.metricRule, plan.entry.metricRule.minSeconds)
    case "terminal":
      return true
    /* c8 ignore next 2 */
    default:
      return assertNever(plan.entry.metricRule)
  }
}

function setValueMeetsMinimum(set: SetRecord, rule: MetricRule, minimum: number): boolean {
  switch (rule.laterality) {
    case "none":
      return set.kind === "single" && set.value >= minimum
    case "perSide":
      return set.kind === "perSide" && set.left >= minimum && set.right >= minimum
    /* c8 ignore next 2 */
    default:
      return assertNever(rule.laterality)
  }
}

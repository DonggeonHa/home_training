import { assertNever } from "../../domain/assert-never"
import { loadStoredState } from "../../storage/persistence"
import type { StoragePort } from "../../storage/ports"
import type { StoredState } from "../../storage/schemas"
import { reduceSafetyAnswers, startAssessment, submitAssessmentSet } from "./assessment-reducer"
import type { AppStoreAction, AppStoreState } from "./types"
import { applyActiveSessionChange, applyWorkoutCompletion } from "./workout-reducer"

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
    case "activeSessionChanged":
      return applyActiveSessionChange(state, action.activeSession)
    case "workoutCompletionApplied":
      return applyWorkoutCompletion(state, action.patch)
    case "saveSucceeded":
      return { ...state, saveNotice: undefined }
    default:
      return assertNever(action)
  }
}

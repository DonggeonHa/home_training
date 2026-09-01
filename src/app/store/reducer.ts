import { assertNever } from "../../domain/assert-never"
import { loadStoredState } from "../../storage/persistence"
import type { StoragePort } from "../../storage/ports"
import type { StoredState } from "../../storage/schemas"
import { loadReducedMotionPreference, loadThemePreference, resolveThemePreference } from "../theme"
import { reduceSafetyAnswers, startAssessment, submitAssessmentSet } from "./assessment-reducer"
import type { AppStoreAction, AppStoreState } from "./types"
import { applyActiveSessionChange, applyWorkoutCompletion } from "./workout-reducer"

export type CreateAppStoreInput = {
  readonly storage: StoragePort
}

export function createAppStoreState(input: CreateAppStoreInput): AppStoreState {
  const result = loadStoredState({ storage: input.storage })
  const prefersDark = readMediaPreference("(prefers-color-scheme: dark)")
  const prefersReducedMotion = readMediaPreference("(prefers-reduced-motion: reduce)")
  const themePreference =
    typeof window === "undefined" ? "system" : loadThemePreference(window.localStorage)
  const reducedMotionPreference =
    typeof window === "undefined" ? "system" : loadReducedMotionPreference(window.localStorage)

  return {
    display: {
      prefersDark,
      prefersReducedMotion,
      reducedMotionPreference,
      resolvedTheme: resolveThemePreference(themePreference, prefersDark),
      themePreference,
    },
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
    case "displayPreferencesChanged":
      return resolveDisplayState({
        ...state,
        display: {
          ...state.display,
          reducedMotionPreference:
            action.reducedMotionPreference ?? state.display.reducedMotionPreference,
          themePreference: action.themePreference ?? state.display.themePreference,
        },
      })
    case "systemDisplayPreferencesChanged":
      return resolveDisplayState({
        ...state,
        display: {
          ...state.display,
          prefersDark: action.prefersDark,
          prefersReducedMotion: action.prefersReducedMotion,
        },
      })
    case "stateReplaced":
      return { ...state, saveNotice: undefined, stored: action.state }
    case "saveSucceeded":
      return { ...state, saveNotice: undefined }
    default:
      return assertNever(action)
  }
}

function resolveDisplayState(state: AppStoreState): AppStoreState {
  return {
    ...state,
    display: {
      ...state.display,
      resolvedTheme: resolveThemePreference(
        state.display.themePreference,
        state.display.prefersDark,
      ),
    },
  }
}

function readMediaPreference(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }

  return window.matchMedia(query).matches
}

import { type Dispatch, type MutableRefObject, useCallback, useMemo } from "react"
import { saveStoredState } from "../../storage/persistence"
import type { StoragePort } from "../../storage/ports"
import { currentCategoryKey } from "./selectors"
import type {
  AppStoreAction,
  AppStoreState,
  AssessmentSetInput,
  SafetyAnswers,
  WorkoutCompletionPatch,
} from "./types"

export type AppActions = {
  readonly submitSafetyAnswers: (answers: SafetyAnswers) => void
  readonly resetSafetyReview: () => void
  readonly startAssessment: () => void
  readonly submitAssessmentSet: (input: AssessmentSetInput) => void
  readonly changeActiveSession: (activeSession: AppStoreState["stored"]["activeSession"]) => void
  readonly applyWorkoutCompletion: (patch: WorkoutCompletionPatch) => void
  readonly replaceStoredState: (state: AppStoreState["stored"]) => ReplaceStoredStateResult
  readonly setReducedMotionPreference: (
    preference: AppStoreState["display"]["reducedMotionPreference"],
  ) => void
  readonly setThemePreference: (preference: AppStoreState["display"]["themePreference"]) => void
}

export type ReplaceStoredStateResult =
  | {
      readonly kind: "saved"
    }
  | {
      readonly kind: "failed"
      readonly reason: "storageSaveFailed"
    }

type AppActionCreatorInput = {
  readonly dispatch: Dispatch<AppStoreAction>
  readonly failedSnapshotRef: MutableRefObject<string | null>
  readonly lastSavedSnapshotRef: MutableRefObject<string>
  readonly state: AppStoreState
  readonly storageRef: MutableRefObject<StoragePort>
}

export function useAppActionCreators(input: AppActionCreatorInput): AppActions {
  const { dispatch, failedSnapshotRef, lastSavedSnapshotRef, state, storageRef } = input
  const submitSafetyAnswers = useCallback(
    (answers: SafetyAnswers) => {
      dispatch({
        type: "safetyAnswersSubmitted",
        answers,
        now: new Date().toISOString(),
      })
    },
    [dispatch],
  )
  const resetSafetyReview = useCallback(() => dispatch({ type: "safetyReviewReset" }), [dispatch])
  const startAssessment = useCallback(() => dispatch({ type: "assessmentStarted" }), [dispatch])
  const submitAssessmentSet = useCallback(
    (input: AssessmentSetInput) => {
      const assessment = state.stored.assessment
      if (assessment.currentCategoryId === null) {
        return
      }
      const categoryKey = currentCategoryKey(assessment.currentCategoryId)
      dispatch({
        type: "assessmentSetSubmitted",
        categoryId: assessment.currentCategoryId,
        level: assessment.nextLevelByCategory[categoryKey],
        input,
      })
    },
    [dispatch, state.stored.assessment],
  )
  const changeActiveSession = useCallback(
    (activeSession: AppStoreState["stored"]["activeSession"]) =>
      dispatch({ type: "activeSessionChanged", activeSession }),
    [dispatch],
  )
  const applyWorkoutCompletion = useCallback(
    (patch: WorkoutCompletionPatch) => dispatch({ type: "workoutCompletionApplied", patch }),
    [dispatch],
  )
  const replaceStoredState = useCallback(
    (nextState: AppStoreState["stored"]) => {
      const result = saveStoredState({ storage: storageRef.current, state: nextState })
      if (result.kind === "failed") {
        dispatch({ type: "saveFailed", reason: result.reason })
        return { kind: "failed", reason: "storageSaveFailed" } satisfies ReplaceStoredStateResult
      }

      const nextSnapshot = JSON.stringify(nextState)
      lastSavedSnapshotRef.current = nextSnapshot
      failedSnapshotRef.current = null
      dispatch({ type: "stateReplaced", state: nextState })
      return { kind: "saved" } satisfies ReplaceStoredStateResult
    },
    [dispatch, failedSnapshotRef, lastSavedSnapshotRef, storageRef],
  )
  const setReducedMotionPreference = useCallback(
    (reducedMotionPreference: AppStoreState["display"]["reducedMotionPreference"]) =>
      dispatch({ type: "displayPreferencesChanged", reducedMotionPreference }),
    [dispatch],
  )
  const setThemePreference = useCallback(
    (themePreference: AppStoreState["display"]["themePreference"]) =>
      dispatch({ type: "displayPreferencesChanged", themePreference }),
    [dispatch],
  )

  return useMemo(
    () => ({
      applyWorkoutCompletion,
      changeActiveSession,
      replaceStoredState,
      resetSafetyReview,
      setReducedMotionPreference,
      setThemePreference,
      startAssessment,
      submitAssessmentSet,
      submitSafetyAnswers,
    }),
    [
      applyWorkoutCompletion,
      changeActiveSession,
      replaceStoredState,
      resetSafetyReview,
      setReducedMotionPreference,
      setThemePreference,
      startAssessment,
      submitAssessmentSet,
      submitSafetyAnswers,
    ],
  )
}

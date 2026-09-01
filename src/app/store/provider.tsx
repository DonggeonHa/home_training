import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { saveStoredState } from "../../storage/persistence"
import { BrowserLocalStoragePort, type StoragePort } from "../../storage/ports"
import { storeReducedMotionPreference, storeThemePreference } from "../theme"
import { createAppStoreState, reduceAppStore, toStoredState } from "./reducer"
import { currentCategoryKey } from "./selectors"
import type {
  AppStoreAction,
  AppStoreState,
  AssessmentSetInput,
  SafetyAnswers,
  WorkoutCompletionPatch,
} from "./types"

type AppActions = {
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

type AppStoreContextValue = {
  readonly state: AppStoreState
  readonly actions: AppActions
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null)

type AppStoreProviderProps = {
  readonly children: ReactNode
  readonly storage?: StoragePort | undefined
}

export function AppStoreProvider({ children, storage }: AppStoreProviderProps) {
  const storageRef = useRef(storage ?? new BrowserLocalStoragePort())
  const [state, dispatch] = useReducer(reduceAppStore, storageRef.current, (initialStorage) =>
    createAppStoreState({ storage: initialStorage }),
  )
  const [initialStoredSnapshot] = useState(() => JSON.stringify(toStoredState(state)))
  const lastSavedSnapshotRef = useRef(initialStoredSnapshot)
  const failedSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    const stored = toStoredState(state)
    const nextSnapshot = JSON.stringify(stored)
    if (
      nextSnapshot === lastSavedSnapshotRef.current ||
      nextSnapshot === failedSnapshotRef.current
    ) {
      return
    }

    const result = saveStoredState({ storage: storageRef.current, state: stored })
    if (result.kind === "saved") {
      lastSavedSnapshotRef.current = nextSnapshot
      failedSnapshotRef.current = null
      dispatch({ type: "saveSucceeded" })
      return
    }
    failedSnapshotRef.current = nextSnapshot
    dispatch({ type: "saveFailed", reason: result.reason })
  }, [state])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    storeThemePreference(window.localStorage, state.display.themePreference)
  }, [state.display.themePreference])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    storeReducedMotionPreference(window.localStorage, state.display.reducedMotionPreference)
  }, [state.display.reducedMotionPreference])

  useEffect(() => {
    const colorMatcher = createMediaMatcher("(prefers-color-scheme: dark)")
    const motionMatcher = createMediaMatcher("(prefers-reduced-motion: reduce)")
    const updatePreferences = () =>
      dispatch({
        type: "systemDisplayPreferencesChanged",
        prefersDark: colorMatcher?.matches ?? false,
        prefersReducedMotion: motionMatcher?.matches ?? false,
      })

    colorMatcher?.addEventListener("change", updatePreferences)
    motionMatcher?.addEventListener("change", updatePreferences)

    return () => {
      colorMatcher?.removeEventListener("change", updatePreferences)
      motionMatcher?.removeEventListener("change", updatePreferences)
    }
  }, [])

  const actions = useAppActionCreators({
    dispatch,
    failedSnapshotRef,
    lastSavedSnapshotRef,
    state,
    storageRef,
  })
  const value = useMemo(() => ({ state, actions }), [actions, state])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreContextValue {
  const value = useContext(AppStoreContext)
  if (value === null) {
    throw new AppStoreProviderError()
  }
  return value
}

type AppActionCreatorInput = {
  readonly dispatch: React.Dispatch<AppStoreAction>
  readonly failedSnapshotRef: React.MutableRefObject<string | null>
  readonly lastSavedSnapshotRef: React.MutableRefObject<string>
  readonly state: AppStoreState
  readonly storageRef: React.MutableRefObject<StoragePort>
}

function useAppActionCreators(input: AppActionCreatorInput): AppActions {
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

function createMediaMatcher(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }

  return window.matchMedia(query)
}

class AppStoreProviderError extends Error {
  readonly name = "AppStoreProviderError"

  constructor() {
    super("AppStoreProvider must be mounted before using the app store")
  }
}

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
import { createAppStoreState, reduceAppStore, toStoredState } from "./reducer"
import { currentCategoryKey } from "./selectors"
import type { AppStoreAction, AppStoreState, AssessmentSetInput, SafetyAnswers } from "./types"

type AppActions = {
  readonly submitSafetyAnswers: (answers: SafetyAnswers) => void
  readonly resetSafetyReview: () => void
  readonly startAssessment: () => void
  readonly submitAssessmentSet: (input: AssessmentSetInput) => void
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

  const actions = useAppActionCreators(state, dispatch)
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

function useAppActionCreators(
  state: AppStoreState,
  dispatch: React.Dispatch<AppStoreAction>,
): AppActions {
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

  return useMemo(
    () => ({ submitSafetyAnswers, resetSafetyReview, startAssessment, submitAssessmentSet }),
    [resetSafetyReview, startAssessment, submitAssessmentSet, submitSafetyAnswers],
  )
}

class AppStoreProviderError extends Error {
  readonly name = "AppStoreProviderError"

  constructor() {
    super("AppStoreProvider must be mounted before using the app store")
  }
}

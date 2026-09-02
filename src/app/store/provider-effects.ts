import { type Dispatch, type MutableRefObject, useEffect } from "react"
import { saveStoredState } from "../../storage/persistence"
import type { StoragePort } from "../../storage/ports"
import {
  getBrowserPreferenceStorage,
  storeReducedMotionPreference,
  storeThemePreference,
} from "../theme"
import { toStoredState } from "./reducer"
import type { AppStoreAction, AppStoreState } from "./types"

type StoredStatePersistenceInput = {
  readonly dispatch: Dispatch<AppStoreAction>
  readonly failedSnapshotRef: MutableRefObject<string | null>
  readonly lastSavedSnapshotRef: MutableRefObject<string>
  readonly state: AppStoreState
  readonly storageRef: MutableRefObject<StoragePort>
}

export function useStoredStatePersistence(input: StoredStatePersistenceInput): void {
  const { dispatch, failedSnapshotRef, lastSavedSnapshotRef, state, storageRef } = input

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
  }, [dispatch, failedSnapshotRef, lastSavedSnapshotRef, state, storageRef])
}

export function useDisplayPreferencePersistence(display: AppStoreState["display"]): void {
  useEffect(() => {
    const preferenceStorage = getBrowserPreferenceStorage()
    if (preferenceStorage === null) {
      return
    }
    storeThemePreference(preferenceStorage, display.themePreference)
  }, [display.themePreference])

  useEffect(() => {
    const preferenceStorage = getBrowserPreferenceStorage()
    if (preferenceStorage === null) {
      return
    }
    storeReducedMotionPreference(preferenceStorage, display.reducedMotionPreference)
  }, [display.reducedMotionPreference])
}

export function useSystemDisplayPreferenceSubscription(dispatch: Dispatch<AppStoreAction>): void {
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
  }, [dispatch])
}

function createMediaMatcher(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }

  return window.matchMedia(query)
}

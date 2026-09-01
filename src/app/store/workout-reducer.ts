import type { AppStoreState, WorkoutCompletionPatch } from "./types"

export function applyActiveSessionChange(
  state: AppStoreState,
  activeSession: AppStoreState["stored"]["activeSession"],
): AppStoreState {
  return { ...state, stored: { ...state.stored, activeSession } }
}

export function applyWorkoutCompletion(
  state: AppStoreState,
  patch: WorkoutCompletionPatch,
): AppStoreState {
  const completedSessions =
    patch.completedSession === undefined ||
    state.stored.completedSessions.some((session) => session.id === patch.completedSession?.id)
      ? state.stored.completedSessions
      : [...state.stored.completedSessions, patch.completedSession]

  return {
    ...state,
    stored: {
      ...state.stored,
      activeSession: patch.activeSession,
      completedSessions,
      nextRoutine: patch.nextRoutine ?? state.stored.nextRoutine,
      progress: patch.progress ?? state.stored.progress,
    },
  }
}

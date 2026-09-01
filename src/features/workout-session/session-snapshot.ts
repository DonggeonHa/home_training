import type { ActiveSession } from "../../storage/schemas"
import type {
  WorkoutCategoryPlan,
  WorkoutCategoryWarmupState,
  WorkoutSession,
  WorkoutState,
} from "./types"

type ActiveWorkoutSnapshot = NonNullable<ActiveSession["workout"]>

export function restoreWorkoutSession(activeSession: ActiveSession): WorkoutSession | null {
  if (activeSession.workout === undefined) {
    return null
  }

  return {
    id: activeSession.id,
    routineId: activeSession.routineId,
    startedAt: activeSession.startedAt,
    currentCategoryIndex: activeSession.workout.currentCategoryIndex,
    commonWarmupComplete: activeSession.workout.commonWarmupComplete,
    categoryWarmupCompleteByCategory: activeSession.workout.categoryWarmupCompleteByCategory,
    categoryPlans: activeSession.workout.categoryPlans,
    restEndsAt: activeSession.restTimer?.restEndsAt ?? null,
    lastAnnouncement: activeSession.workout.lastAnnouncement,
    completed: activeSession.workout.phase === "complete",
  }
}

export function restoreWorkoutState(
  activeSession: ActiveSession,
  nowMs: number,
): WorkoutState | null {
  const session = restoreWorkoutSession(activeSession)
  if (session === null || activeSession.workout === undefined) {
    return null
  }

  return {
    session,
    setDraft: activeSession.workout.setDraft ?? null,
    error: activeSession.workout.error,
    nowMs,
    lastAnnouncement: activeSession.workout.lastAnnouncement,
    showAbandonDialog: activeSession.workout.showAbandonDialog,
  }
}

export function toWorkoutSnapshot(state: WorkoutState): ActiveWorkoutSnapshot {
  if (state.session === null) {
    throw new Error("workout state has no active session")
  }
  const session = state.session
  const plan = readCurrentPlan(session)
  return {
    currentCategoryIndex: session.currentCategoryIndex,
    currentSetIndex: plan.entry.sets.length,
    phase: derivePhase(state),
    commonWarmupComplete: session.commonWarmupComplete,
    categoryWarmupCompleteByCategory: session.categoryWarmupCompleteByCategory,
    categoryPlans: session.categoryPlans.map((categoryPlan) => ({
      ...categoryPlan,
      qualification: null,
    })),
    setDraft: state.setDraft,
    error: state.error,
    showAbandonDialog: state.showAbandonDialog,
    lastAnnouncement: session.lastAnnouncement,
  }
}

export function defaultCategoryWarmupState(): WorkoutCategoryWarmupState {
  return {
    push: false,
    pull: false,
    squat: false,
    hinge: false,
    verticalPush: false,
    core: false,
  }
}

function derivePhase(state: WorkoutState): ActiveWorkoutSnapshot["phase"] {
  if (state.session === null) {
    throw new Error("workout state has no active session")
  }
  if (state.setDraft !== null) {
    return "setEntry"
  }
  const session = state.session
  if (session.completed) {
    return "complete"
  }
  if (session.restEndsAt !== null) {
    return "rest"
  }
  return "guidance"
}

function readCurrentPlan(session: WorkoutSession): WorkoutCategoryPlan {
  const plan = session.categoryPlans[session.currentCategoryIndex]
  if (plan === undefined) {
    throw new Error("workout session has no current category")
  }
  return plan
}

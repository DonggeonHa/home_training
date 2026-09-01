import { assertNever } from "../../domain/assert-never"
import type { SessionId, SetQuality } from "../../domain/contracts"
import { adjustRestTimer, getRestTimerSnapshot, skipRestTimer } from "../../domain/rest-timer"
import type { StoredState } from "../../storage/schemas"
import { startWorkoutSession } from "./engine"
import {
  changeDraftText,
  changeQuality,
  completeCategoryWarmup,
  confirmPullChecklist,
  type DraftTextField,
  openSetDraft,
  saveSet,
} from "./reducer-draft"
import { restoreWorkoutState } from "./session-snapshot"
import { updateSession } from "./session-state-helpers"
import type { WorkoutState } from "./types"

export type CreateWorkoutStateInput = {
  readonly stored: StoredState
  readonly nowMs: number
  readonly sessionId?: SessionId | undefined
}

export type WorkoutAction =
  | { readonly type: "commonWarmupCompleted" }
  | { readonly type: "categoryWarmupCompleted" }
  | { readonly type: "pullChecklistConfirmed" }
  | { readonly type: "setDraftOpened" }
  | { readonly type: "draftTextChanged"; readonly field: DraftTextField; readonly value: string }
  | { readonly type: "qualityChanged"; readonly field: keyof SetQuality; readonly value: boolean }
  | { readonly type: "setSaved" }
  | { readonly type: "restAdjusted"; readonly deltaSeconds: 30 | -30 }
  | { readonly type: "restSkipped" }
  | { readonly type: "tick"; readonly nowMs: number }
  | { readonly type: "categoryAdvanced" }
  | { readonly type: "abandonRequested" }
  | { readonly type: "abandonCancelled" }
  | { readonly type: "abandonConfirmed" }

export function createWorkoutState(input: CreateWorkoutStateInput): WorkoutState {
  return startWorkoutState(input)
}

export function startWorkoutState(input: CreateWorkoutStateInput): WorkoutState {
  if (input.stored.activeSession !== null) {
    const restored = restoreWorkoutState(input.stored.activeSession, input.nowMs)
    if (restored !== null) {
      return restored
    }
  }
  const session = startWorkoutSession({
    now: new Date(input.nowMs),
    sessionId: input.sessionId,
    stored: input.stored,
  })
  return {
    session,
    setDraft: null,
    error: null,
    nowMs: input.nowMs,
    lastAnnouncement: session.lastAnnouncement,
    showAbandonDialog: false,
  }
}

export function reduceWorkout(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case "commonWarmupCompleted":
      return updateSession(state, { commonWarmupComplete: true })
    case "categoryWarmupCompleted":
      return completeCategoryWarmup(state)
    case "pullChecklistConfirmed":
      return confirmPullChecklist(state)
    case "setDraftOpened":
      return openSetDraft(state)
    case "draftTextChanged":
      return changeDraftText(state, action.field, action.value)
    case "qualityChanged":
      return changeQuality(state, action.field, action.value)
    case "setSaved":
      return saveSet(state)
    case "restAdjusted":
      return adjustRest(state, action.deltaSeconds)
    case "restSkipped":
      return skipRest(state)
    case "tick":
      return tickRest(state, action.nowMs)
    case "categoryAdvanced":
      return advanceCategory(state)
    case "abandonRequested":
      return { ...state, showAbandonDialog: true }
    case "abandonCancelled":
      return { ...state, showAbandonDialog: false }
    case "abandonConfirmed":
      return { ...state, session: null, setDraft: null, showAbandonDialog: false }
    /* c8 ignore next 2 */
    default:
      return assertNever(action)
  }
}

function adjustRest(state: WorkoutState, deltaSeconds: 30 | -30): WorkoutState {
  if (state.session?.restEndsAt === null || state.session === null) {
    return state
  }
  return updateSession(state, {
    restEndsAt: adjustRestTimer({
      deltaSeconds,
      nowMs: state.nowMs,
      timer: { restEndsAt: state.session.restEndsAt },
    }).restEndsAt,
  })
}

function skipRest(state: WorkoutState): WorkoutState {
  if (state.session?.restEndsAt === null || state.session === null) {
    return state
  }
  return updateSession(state, {
    restEndsAt: skipRestTimer({
      nowMs: state.nowMs,
      timer: { restEndsAt: state.session.restEndsAt },
    }).restEndsAt,
  })
}

function tickRest(state: WorkoutState, nowMs: number): WorkoutState {
  if (state.session?.restEndsAt === null || state.session === null) {
    return { ...state, nowMs }
  }
  const snapshot = getRestTimerSnapshot({
    nowMs,
    previousRemainingSeconds: getRestTimerSnapshot({
      nowMs: state.nowMs,
      timer: { restEndsAt: state.session.restEndsAt },
    }).remainingSeconds,
    timer: { restEndsAt: state.session.restEndsAt },
  })
  return {
    ...state,
    nowMs,
    lastAnnouncement: snapshot.announcements.at(-1) ?? state.lastAnnouncement,
    session: {
      ...state.session,
      lastAnnouncement: snapshot.announcements.at(-1) ?? state.session.lastAnnouncement,
      restEndsAt: snapshot.remainingSeconds === 0 ? null : state.session.restEndsAt,
    },
  }
}

function advanceCategory(state: WorkoutState): WorkoutState {
  if (state.session === null || state.session.completed) {
    return state
  }
  const nextIndex = state.session.currentCategoryIndex + 1
  return {
    ...state,
    error: null,
    session:
      nextIndex >= state.session.categoryPlans.length
        ? { ...state.session, completed: true, restEndsAt: null }
        : { ...state.session, currentCategoryIndex: nextIndex, restEndsAt: null },
  }
}

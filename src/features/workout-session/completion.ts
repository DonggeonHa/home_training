import { currentCategoryKey } from "../../app/store/selectors"
import { assertNever } from "../../domain/assert-never"
import type {
  CategoryProgress,
  CompletedSession,
  SessionEntry,
  SessionId,
} from "../../domain/contracts"
import {
  evaluateLevelTest,
  evaluateSessionQualification,
} from "../../domain/progression/progression"
import { getNextRoutine } from "../../domain/routines"
import type { StoredState } from "../../storage/schemas"
import type { WorkoutCategoryPlan, WorkoutSession, WorkoutStoragePatch } from "./types"

export type FinishWorkoutInput = {
  readonly session: WorkoutSession
  readonly stored: StoredState
  readonly now: Date
}

export function finishWorkout(input: FinishWorkoutInput): WorkoutStoragePatch {
  const completedSession: CompletedSession = {
    id: input.session.id,
    routineId: input.session.routineId,
    completedAt: input.session.startedAt,
    entries: input.session.categoryPlans.flatMap((plan) =>
      plan.testAttemptEntry === undefined ? [plan.entry] : [plan.testAttemptEntry, plan.entry],
    ),
  }
  if (input.stored.completedSessions.some((session) => session.id === completedSession.id)) {
    return { activeSession: null }
  }

  return {
    activeSession: null,
    completedSession,
    nextRoutine: getNextRoutine(input.session.routineId),
    progress: updateProgressFromSession({
      completedSession,
      plans: input.session.categoryPlans,
      stored: input.stored,
    }),
  }
}

function updateProgressFromSession(input: {
  readonly completedSession: CompletedSession
  readonly plans: readonly WorkoutCategoryPlan[]
  readonly stored: StoredState
}): StoredState["progress"] {
  const progress = { ...input.stored.progress }
  for (const plan of input.plans) {
    const key = currentCategoryKey(plan.categoryId)
    const currentProgress = progress[key]
    const nextProgress =
      plan.testAttemptEntry !== undefined
        ? currentProgress
        : plan.entry.level > currentProgress.level
          ? evaluateLevelTest({
              currentLevel: currentProgress.level,
              entry: plan.entry,
              nextLevel: plan.entry.level,
              progress: currentProgress,
            }).progress
          : evaluateSessionQualification({
                completedSessionCount: input.stored.completedSessions.length,
                entry: plan.entry,
                progress: currentProgress,
                sessionId: input.completedSession.id,
              }).kind === "adaptation"
            ? currentProgress
            : readQualifiedProgress({
                currentProgress,
                entry: plan.entry,
                sessionId: input.completedSession.id,
                completedSessionCount: input.stored.completedSessions.length,
              })
    progress[key] = nextProgress
  }
  return progress
}

function readQualifiedProgress(input: {
  readonly currentProgress: CategoryProgress
  readonly entry: SessionEntry
  readonly sessionId: SessionId
  readonly completedSessionCount: number
}): CategoryProgress {
  const result = evaluateSessionQualification({
    completedSessionCount: input.completedSessionCount,
    entry: input.entry,
    progress: input.currentProgress,
    sessionId: input.sessionId,
  })
  switch (result.kind) {
    case "qualified":
    case "testUnlocked":
      return {
        ...input.currentProgress,
        qualifiedSessionIds: result.qualifiedSessionIds,
        status: result.status,
      }
    case "adaptation":
    case "notQualified":
      return input.currentProgress
    /* c8 ignore next 2 */
    default:
      return assertNever(result)
  }
}

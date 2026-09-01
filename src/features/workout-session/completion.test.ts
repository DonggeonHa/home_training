import { describe, expect, it } from "vitest"
import { SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import {
  categoryId,
  finishWorkout,
  readCatalogCategory,
  readLevel,
  startWorkoutSession,
} from "./engine"
import type { WorkoutCategoryPlan, WorkoutSession } from "./types"

const startedAt = new Date("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("22222222-2222-4222-8222-222222222222")

describe("workout session completion", () => {
  it("completes once with session date from start date and advances routine pointer", () => {
    const stored = createCompletedOnboardingState()
    const session = startWorkoutSession({ stored, now: startedAt, sessionId })
    const patch = finishWorkout({
      session: { ...session, completed: true },
      stored,
      now: startedAt,
    })
    const repeated = finishWorkout({
      session: { ...session, completed: true },
      stored: {
        ...stored,
        completedSessions:
          patch.completedSession === undefined
            ? stored.completedSessions
            : [...stored.completedSessions, patch.completedSession],
      },
      now: startedAt,
    })

    expect(patch.completedSession?.completedAt).toBe(startedAt.toISOString())
    expect(patch.nextRoutine).toBe("B")
    expect(repeated.completedSession).toBeUndefined()
  })

  it("keeps adaptation sessions at current progress without qualification", () => {
    const stored = createCompletedOnboardingState()
    const session = startWorkoutSession({ stored, now: startedAt, sessionId })
    const patch = finishWorkout({
      session: { ...session, completed: true },
      stored,
      now: startedAt,
    })

    expect(patch.progress?.squat).toEqual(stored.progress.squat)
  })

  it("unlocks test after the second distinct full qualification", () => {
    const stored = {
      ...createCompletedOnboardingState(),
      completedSessions: Array.from({ length: 6 }, (_, index) => ({
        id: SessionIdSchema.parse(`33333333-3333-4333-8333-33333333333${index}`),
        routineId: "A" as const,
        completedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
        entries: [],
      })),
      progress: {
        ...createCompletedOnboardingState().progress,
        squat: {
          ...createCompletedOnboardingState().progress.squat,
          qualifiedSessionIds: [SessionIdSchema.parse("44444444-4444-4444-8444-444444444444")],
          status: "active" as const,
        },
      },
    }
    const session = startWorkoutSession({ stored, now: startedAt, sessionId })
    const squatPlan = readPlan(session, 0)
    const qualifiedSession = replacePlan(session, {
      ...squatPlan,
      entry: { ...squatPlan.entry, sets: [singleSet(15, 2), singleSet(15, 2), singleSet(15, 2)] },
    })

    const patch = finishWorkout({ session: qualifiedSession, stored, now: startedAt })

    expect(patch.progress?.squat.status).toBe("testUnlocked")
    expect(patch.progress?.squat.qualifiedSessionIds).toHaveLength(2)
  })

  it("does not demote or lock on a failed next-level test", () => {
    const stored = createCompletedOnboardingState()
    const progress = {
      ...stored.progress,
      squat: { ...stored.progress.squat, level: 1, status: "testUnlocked" as const },
    }
    const session = startWorkoutSession({
      stored: { ...stored, progress },
      now: startedAt,
      sessionId,
    })
    const failedPlan = readPlan(session, 0)
    const failedTest = replacePlan(session, {
      ...failedPlan,
      entry: { ...failedPlan.entry, sets: [singleSet(3, 2), singleSet(15, 2), singleSet(15, 2)] },
    })

    const patch = finishWorkout({
      session: failedTest,
      stored: { ...stored, progress },
      now: startedAt,
    })

    expect(patch.progress?.squat).toMatchObject({ level: 1, status: "testUnlocked" })
  })

  it("keeps mixed fallback entries without consuming a test unlock", () => {
    const stored = createCompletedOnboardingState()
    const progress = {
      ...stored.progress,
      squat: { ...stored.progress.squat, level: 0, status: "testUnlocked" as const },
    }
    const session = startWorkoutSession({
      stored: { ...stored, progress },
      now: startedAt,
      sessionId,
    })
    const squatPlan = readPlan(session, 0)
    const fallbackLevel = readLevel(readCatalogCategory(categoryId("squat")), 0)
    const mixedSession = replacePlan(session, {
      ...squatPlan,
      entry: {
        categoryId: squatPlan.categoryId,
        exerciseName: fallbackLevel.name,
        level: fallbackLevel.level,
        metricRule: fallbackLevel.metricRule,
        sets: [singleSet(15, 2), singleSet(15, 2)],
      },
      testAttemptEntry: { ...squatPlan.entry, sets: [singleSet(3, 2)] },
    })

    const patch = finishWorkout({
      session: mixedSession,
      stored: { ...stored, progress },
      now: startedAt,
    })

    expect(patch.progress?.squat).toMatchObject({ level: 0, status: "testUnlocked" })
    expect(patch.completedSession?.entries.slice(0, 2).map((entry) => entry.level)).toEqual([1, 0])
  })
})

function singleSet(value: number, rir: number) {
  return {
    kind: "single" as const,
    value,
    rir,
    quality: { pain: false, form: "good" as const, rom: "full" as const },
  }
}

function readPlan(session: WorkoutSession, index: number): WorkoutCategoryPlan {
  const plan = session.categoryPlans[index]
  if (plan === undefined) {
    throw new Error(`missing test workout plan at ${index}`)
  }
  return plan
}

function replacePlan(session: WorkoutSession, plan: WorkoutCategoryPlan): WorkoutSession {
  return {
    ...session,
    categoryPlans: session.categoryPlans.map((candidate, index) =>
      index === session.currentCategoryIndex ? plan : candidate,
    ),
  }
}

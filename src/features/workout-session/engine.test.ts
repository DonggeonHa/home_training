import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import { StoredStateSchema } from "../../storage/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import {
  acceptsRir,
  categoryId,
  commonWarmupItems,
  currentCategoryPlan,
  globalStopSignals,
  readCatalogCategory,
  readLevel,
  setMeetsMinimum,
  startWorkoutSession,
  toActiveSessionPatch,
} from "./engine"
import type { WorkoutCategoryPlan, WorkoutSession, WorkoutState } from "./types"

const startedAt = new Date("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("22222222-2222-4222-8222-222222222222")

describe("workout session engine", () => {
  it("resumes persisted active session position and rest timer", () => {
    const stored = {
      ...createCompletedOnboardingState(),
      activeSession: {
        id: sessionId,
        routineId: "A" as const,
        startedAt: startedAt.toISOString(),
        currentEntry: { categoryId: CategoryIdSchema.parse("push"), level: 0 },
        completedSetIndexes: [0],
        restTimer: { restEndsAt: "2026-09-02T00:02:00.000Z" },
      },
    }

    const session = startWorkoutSession({ stored, now: new Date("2026-09-02T00:01:00.000Z") })

    expect(session.commonWarmupComplete).toBe(true)
    expect(session.currentCategoryIndex).toBe(1)
    expect(session.restEndsAt).toBe("2026-09-02T00:02:00.000Z")
    expect(toActiveSessionPatch(workoutState(session))?.currentEntry.categoryId).toBe(
      CategoryIdSchema.parse("push"),
    )
  })

  it("deep-roundtrips active workout state through the parsed storage schema", () => {
    const stored = createCompletedOnboardingState()
    const session = startWorkoutSession({ stored, now: startedAt, sessionId })
    const mixedPlan = {
      ...readPlan(session, 0),
      entry: { ...readPlan(session, 0).entry, sets: [singleSet(12, 1), singleSet(13, 2)] },
      stoppedByPain: true,
      pullChecklistConfirmed: true,
      testAttemptEntry: { ...readPlan(session, 0).entry, sets: [singleSet(3, 2)] },
    }
    const activeSession = toActiveSessionPatch(
      workoutState({
        ...session,
        currentCategoryIndex: 1,
        commonWarmupComplete: true,
        categoryPlans: session.categoryPlans.map((plan, index) => (index === 0 ? mixedPlan : plan)),
        restEndsAt: "2026-09-02T00:02:00.000Z",
        lastAnnouncement: "30",
      }),
    )
    const parsed = StoredStateSchema.parse(structuredClone({ ...stored, activeSession }))

    const resumed = startWorkoutSession({ stored: parsed, now: new Date(startedAt.getTime() + 1) })

    expect(resumed.currentCategoryIndex).toBe(1)
    expect(resumed.commonWarmupComplete).toBe(true)
    expect(resumed.restEndsAt).toBe("2026-09-02T00:02:00.000Z")
    expect(resumed.lastAnnouncement).toBe("30")
    expect(resumed.categoryPlans[0]).toMatchObject({
      stoppedByPain: true,
      pullChecklistConfirmed: true,
      entry: {
        sets: [expect.objectContaining({ value: 12 }), expect.objectContaining({ rir: 2 })],
      },
      testAttemptEntry: { sets: [expect.objectContaining({ value: 3 })] },
    })
  })

  it("restores completed workout snapshots without requiring a rest timer", () => {
    const stored = createCompletedOnboardingState()
    const activeSession = toActiveSessionPatch(
      workoutState({
        ...startWorkoutSession({ stored, now: startedAt, sessionId }),
        completed: true,
        restEndsAt: null,
      }),
    )
    const parsed = StoredStateSchema.parse(structuredClone({ ...stored, activeSession }))

    const resumed = startWorkoutSession({ stored: parsed, now: startedAt })

    expect(activeSession?.workout?.phase).toBe("complete")
    expect(resumed.completed).toBe(true)
    expect(resumed.restEndsAt).toBeNull()
  })

  it("exposes content helpers, category parsing, RIR rules, and minimum checks", () => {
    const push = readCatalogCategory(categoryId("push"))
    const pushLevel = readLevel(push, 0)
    const pull = readCatalogCategory(categoryId("pull"))
    const pullLevel = readLevel(pull, 0)
    const session = startWorkoutSession({
      stored: createCompletedOnboardingState(),
      now: startedAt,
      sessionId,
    })

    expect(commonWarmupItems()).toHaveLength(6)
    expect(globalStopSignals()).toContain("흉통")
    expect(currentCategoryPlan(session).categoryTitle).toBe("SQUAT")
    expect(acceptsRir(pushLevel.metricRule)).toBe(true)
    expect(acceptsRir(pullLevel.metricRule)).toBe(false)
    expect(
      setMeetsMinimum({
        categoryId: push.id,
        exerciseName: pushLevel.name,
        level: pushLevel.level,
        metricRule: pushLevel.metricRule,
        sets: [],
      }),
    ).toBe(false)
  })

  it("throws for unknown current category and missing catalog levels", () => {
    const session = startWorkoutSession({
      stored: createCompletedOnboardingState(),
      now: startedAt,
      sessionId,
    })
    const push = readCatalogCategory(categoryId("push"))

    expect(() => currentCategoryPlan({ ...session, currentCategoryIndex: 99 })).toThrow(
      /no current category/,
    )
    expect(() =>
      toActiveSessionPatch(workoutState({ ...session, currentCategoryIndex: 99 })),
    ).toThrow(/no current category/)
    expect(() => readLevel(push, 99)).toThrow(/unknown workout level/)
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

function workoutState(session: WorkoutSession): WorkoutState {
  return {
    error: null,
    lastAnnouncement: session.lastAnnouncement,
    nowMs: startedAt.getTime(),
    session,
    setDraft: null,
    showAbandonDialog: false,
  }
}

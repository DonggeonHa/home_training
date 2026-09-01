import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import { StoredStateSchema } from "../../storage/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { toActiveSessionPatch } from "./engine"
import { createWorkoutState, reduceWorkout, startWorkoutState } from "./reducer"
import { toWorkoutSnapshot } from "./session-snapshot"

const nowMs = Date.parse("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("66666666-6666-4666-8666-666666666666")

describe("workout state snapshot persistence", () => {
  it("deep-roundtrips open set-entry draft state through the parsed storage schema", () => {
    const stored = createCompletedOnboardingState()
    const opened = reduceWorkout(
      reduceWorkout(
        reduceWorkout(createWorkoutState({ stored, nowMs, sessionId }), {
          type: "commonWarmupCompleted",
        }),
        { type: "categoryWarmupCompleted" },
      ),
      { type: "setDraftOpened" },
    )
    const drafted = reduceWorkout(
      reduceWorkout(
        reduceWorkout(opened, { field: "valueText", type: "draftTextChanged", value: "12" }),
        { field: "rirText", type: "draftTextChanged", value: "1" },
      ),
      { field: "loadText", type: "draftTextChanged", value: "5" },
    )
    const parsed = StoredStateSchema.parse(
      structuredClone({
        ...stored,
        activeSession: toActiveSessionPatch(drafted),
      }),
    )

    const restored = startWorkoutState({ stored: parsed, nowMs: nowMs + 1 })

    expect(parsed.activeSession?.workout?.phase).toBe("setEntry")
    expect(restored.session?.categoryWarmupCompleteByCategory.squat).toBe(true)
    expect(restored.setDraft).toMatchObject({
      kind: "single",
      loadText: "5",
      rirText: "1",
      valueText: "12",
    })
  })

  it("restores mixed test records, rest timer, and current category pointers from state patch bytes", () => {
    const stored = createCompletedOnboardingState()
    const testStored = {
      ...stored,
      progress: {
        ...stored.progress,
        squat: { ...stored.progress.squat, level: 0, status: "testUnlocked" as const },
      },
    }
    const firstSet = reduceWorkout(
      reduceWorkout(
        reduceWorkout(createWorkoutState({ stored: testStored, nowMs, sessionId }), {
          type: "commonWarmupCompleted",
        }),
        { type: "setDraftOpened" },
      ),
      { field: "valueText", type: "draftTextChanged", value: "0" },
    )
    const fallback = reduceWorkout(firstSet, { type: "setSaved" })
    const advanced = reduceWorkout(fallback, { type: "categoryAdvanced" })
    const parsed = StoredStateSchema.parse(
      structuredClone({
        ...testStored,
        activeSession: toActiveSessionPatch(advanced),
      }),
    )

    const restored = startWorkoutState({ stored: parsed, nowMs: nowMs + 30_000 })

    expect(restored.session?.currentCategoryIndex).toBe(1)
    expect(restored.session?.restEndsAt).toBeNull()
    expect(restored.session?.categoryPlans[0]?.testAttemptEntry?.sets).toHaveLength(1)
    expect(restored.session?.categoryPlans[0]?.entry.level).toBe(0)
  })

  it("keeps legacy active-session resume behavior when no workout snapshot exists", () => {
    const stored = {
      ...createCompletedOnboardingState(),
      activeSession: {
        id: sessionId,
        routineId: "A" as const,
        startedAt: new Date(nowMs).toISOString(),
        currentEntry: { categoryId: CategoryIdSchema.parse("push"), level: 0 },
        completedSetIndexes: [0],
        restTimer: { restEndsAt: "2026-09-02T00:02:00.000Z" },
      },
    }

    const restored = startWorkoutState({ stored, nowMs })

    expect(restored.session?.commonWarmupComplete).toBe(true)
    expect(restored.session?.currentCategoryIndex).toBe(1)
    expect(restored.session?.restEndsAt).toBe("2026-09-02T00:02:00.000Z")
  })

  it("throws when a state snapshot has no active session or current category", () => {
    const state = createWorkoutState({
      stored: createCompletedOnboardingState(),
      nowMs,
      sessionId,
    })

    expect(() => toWorkoutSnapshot({ ...state, session: null })).toThrow(/no active session/)
    expect(() =>
      toWorkoutSnapshot({
        ...state,
        session: state.session === null ? null : { ...state.session, currentCategoryIndex: 99 },
      }),
    ).toThrow(/no current category/)
  })
})

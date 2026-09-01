import { describe, expect, it } from "vitest"
import { getRestTimerSnapshot } from "../../domain/rest-timer"
import { SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { createWorkoutState, reduceWorkout } from "./reducer"

const now = new Date("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("11111111-1111-4111-8111-111111111111")

describe("workout session reducer", () => {
  it("starts next routine with common warmup pending and adaptation set count", () => {
    const stored = createCompletedOnboardingState()

    const state = createWorkoutState({ stored, nowMs: now.getTime(), sessionId })

    expect(state.session?.routineId).toBe("A")
    expect(state.session?.commonWarmupComplete).toBe(false)
    expect(state.session?.categoryPlans.map((plan) => plan.prescribedSetCount)).toEqual([
      2, 2, 2, 2,
    ])
  })

  it("requires every pull bar checklist confirmation before set entry", () => {
    const stored = createCompletedOnboardingState()
    const started = completeCurrentCategory(
      reduceWorkout(createWorkoutState({ stored, nowMs: now.getTime(), sessionId }), {
        type: "commonWarmupCompleted",
      }),
    )
    const atPush = completeCurrentCategory(started)
    const atPull = reduceWorkout(atPush, {
      type: "commonWarmupCompleted",
    })

    const blocked = reduceWorkout(atPull, { type: "setDraftOpened" })
    const allowed = reduceWorkout(reduceWorkout(atPull, { type: "pullChecklistConfirmed" }), {
      type: "setDraftOpened",
    })

    expect(blocked.error).toMatch(/철봉/)
    expect(allowed.setDraft?.kind).toBe("single")
  })

  it("rejects direct category advance until warmup and required work are complete", () => {
    const started = reduceWorkout(
      createWorkoutState({
        stored: createCompletedOnboardingState(),
        nowMs: now.getTime(),
        sessionId,
      }),
      { type: "commonWarmupCompleted" },
    )
    const withWarmup = reduceWorkout(started, { type: "categoryWarmupCompleted" })
    const withOneSet = saveSingleSet(withWarmup, "15")

    const blockedWithoutCategoryWarmup = reduceWorkout(started, { type: "categoryAdvanced" })
    const blockedWithoutSets = reduceWorkout(withWarmup, { type: "categoryAdvanced" })
    const blockedWithIncompleteSets = reduceWorkout(withOneSet, { type: "categoryAdvanced" })
    const advanced = reduceWorkout(saveSingleSet(withOneSet, "15"), { type: "categoryAdvanced" })

    expect(blockedWithoutCategoryWarmup.session?.currentCategoryIndex).toBe(0)
    expect(blockedWithoutCategoryWarmup.error).toMatch(/준비/)
    expect(blockedWithoutSets.session?.currentCategoryIndex).toBe(0)
    expect(blockedWithoutSets.error).toMatch(/2세트/)
    expect(blockedWithIncompleteSets.session?.currentCategoryIndex).toBe(0)
    expect(blockedWithIncompleteSets.error).toMatch(/1세트/)
    expect(advanced.session?.currentCategoryIndex).toBe(1)
  })

  it("marks the current category warmup complete", () => {
    const state = reduceWorkout(
      createWorkoutState({
        stored: createCompletedOnboardingState(),
        nowMs: now.getTime(),
        sessionId,
      }),
      { type: "categoryWarmupCompleted" },
    )

    expect(state.session?.categoryWarmupCompleteByCategory.squat).toBe(true)
  })

  it("stops only the current exercise after concerning pain and advances to next category", () => {
    const state = reduceWorkout(
      reduceWorkout(
        createWorkoutState({
          stored: createCompletedOnboardingState(),
          nowMs: now.getTime(),
          sessionId,
        }),
        {
          type: "commonWarmupCompleted",
        },
      ),
      { type: "categoryWarmupCompleted" },
    )
    const draftOpen = reduceWorkout(state, { type: "setDraftOpened" })

    const stopped = reduceWorkout(
      reduceWorkout(
        reduceWorkout(draftOpen, { field: "valueText", type: "draftTextChanged", value: "15" }),
        { field: "pain", type: "qualityChanged", value: true },
      ),
      { type: "setSaved" },
    )
    const advanced = reduceWorkout(stopped, { type: "categoryAdvanced" })

    expect(stopped.session?.categoryPlans[0]?.stoppedByPain).toBe(true)
    expect(stopped.error).toMatch(/119/)
    expect(advanced.session?.currentCategoryIndex).toBe(1)
  })

  it("starts an absolute rest timer with controls and never auto-advances on completion", () => {
    const saved = saveFirstSet()
    const extended = reduceWorkout(saved, { type: "restAdjusted", deltaSeconds: 30 })
    const skipped = reduceWorkout(extended, { type: "restSkipped" })
    const ticked = reduceWorkout(skipped, { type: "tick", nowMs: now.getTime() + 180_000 })

    expect(saved.session?.restEndsAt).toBe("2026-09-02T00:01:30.000Z")
    expect(
      getRestTimerSnapshot({
        timer: { restEndsAt: extended.session?.restEndsAt ?? "" },
        nowMs: now.getTime(),
      }).remainingSeconds,
    ).toBe(120)
    expect(ticked.session?.currentCategoryIndex).toBe(0)
    expect(ticked.session?.restEndsAt).toBeNull()
  })

  it("abandons only after explicit confirmation and never creates a completion patch", () => {
    const state = createWorkoutState({
      stored: createCompletedOnboardingState(),
      nowMs: now.getTime(),
      sessionId,
    })

    const requested = reduceWorkout(state, { type: "abandonRequested" })
    const abandoned = reduceWorkout(requested, { type: "abandonConfirmed" })

    expect(requested.showAbandonDialog).toBe(true)
    expect(abandoned.session).toBeNull()
  })

  it("keeps guard actions as no-ops when session or draft context is missing", () => {
    const state = createWorkoutState({
      stored: createCompletedOnboardingState(),
      nowMs: now.getTime(),
      sessionId,
    })
    const abandoned = reduceWorkout(state, { type: "abandonConfirmed" })

    expect(reduceWorkout(abandoned, { type: "commonWarmupCompleted" })).toBe(abandoned)
    expect(reduceWorkout(abandoned, { type: "categoryWarmupCompleted" })).toBe(abandoned)
    expect(reduceWorkout(abandoned, { type: "pullChecklistConfirmed" })).toBe(abandoned)
    expect(reduceWorkout(abandoned, { type: "setSaved" })).toBe(abandoned)
    expect(reduceWorkout(abandoned, { type: "categoryAdvanced" })).toBe(abandoned)
    expect(reduceWorkout(abandoned, { type: "restAdjusted", deltaSeconds: 30 })).toBe(abandoned)
    expect(reduceWorkout(abandoned, { type: "restSkipped" })).toBe(abandoned)
    expect(
      reduceWorkout(state, { field: "valueText", type: "draftTextChanged", value: "10" }),
    ).toBe(state)
    expect(reduceWorkout(state, { field: "form", type: "qualityChanged", value: true })).toBe(state)
    expect(reduceWorkout(state, { type: "setDraftOpened" }).error).toMatch(/워밍업/)
  })

  it("keeps timer actions stable without an active timer and announces thresholds", () => {
    const state = createWorkoutState({
      stored: createCompletedOnboardingState(),
      nowMs: now.getTime(),
      sessionId,
    })
    const saved = saveFirstSet()
    const announced = reduceWorkout(saved, { type: "tick", nowMs: now.getTime() + 61_000 })

    expect(reduceWorkout(state, { type: "restAdjusted", deltaSeconds: -30 })).toBe(state)
    expect(reduceWorkout(state, { type: "restSkipped" })).toBe(state)
    expect(reduceWorkout(state, { type: "tick", nowMs: now.getTime() + 1_000 }).nowMs).toBe(
      now.getTime() + 1_000,
    )
    expect(announced.lastAnnouncement).toBe("30")
  })
})

function saveFirstSet() {
  const started = reduceWorkout(
    reduceWorkout(
      createWorkoutState({
        stored: createCompletedOnboardingState(),
        nowMs: now.getTime(),
        sessionId,
      }),
      {
        type: "commonWarmupCompleted",
      },
    ),
    { type: "setDraftOpened" },
  )
  const withValue = reduceWorkout(started, {
    field: "valueText",
    type: "draftTextChanged",
    value: "15",
  })
  return reduceWorkout(withValue, { type: "setSaved" })
}

function saveSingleSet(state: ReturnType<typeof createWorkoutState>, value: string) {
  const opened = reduceWorkout(state, { type: "setDraftOpened" })
  const withValue = reduceWorkout(opened, {
    field: "valueText",
    type: "draftTextChanged",
    value,
  })
  return reduceWorkout(withValue, { type: "setSaved" })
}

function completeCurrentCategory(state: ReturnType<typeof createWorkoutState>) {
  const warmed = reduceWorkout(state, { type: "categoryWarmupCompleted" })
  const firstSet = saveSingleSet(warmed, "15")
  const secondSet = saveSingleSet(firstSet, "15")
  return reduceWorkout(secondSet, { type: "categoryAdvanced" })
}

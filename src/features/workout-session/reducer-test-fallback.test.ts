import { describe, expect, it } from "vitest"
import type { SetRecord } from "../../domain/contracts"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { readCatalogCategory, readLevel, startWorkoutSession } from "./engine"
import { createWorkoutState, reduceWorkout } from "./reducer"
import { maybeSwitchFailedFirstTestSetToCurrentLevel } from "./test-fallback"
import type { WorkoutState } from "./types"

const now = new Date("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("11111111-1111-4111-8111-111111111111")

describe("workout session reducer next-level fallback", () => {
  it("switches remaining next-level test sets to current level after a first-set miss", () => {
    const opened = reduceWorkout(
      reduceWorkout(
        createWorkoutState({ stored: testUnlockedState(), nowMs: now.getTime(), sessionId }),
        { type: "commonWarmupCompleted" },
      ),
      { type: "setDraftOpened" },
    )
    const testPlan = opened.session?.categoryPlans[0]
    const testMinimum =
      testPlan?.entry.metricRule.kind === "reps" ? testPlan.entry.metricRule.min : 1
    const failedFirstSet = reduceWorkout(
      reduceWorkout(opened, {
        field: "valueText",
        type: "draftTextChanged",
        value: String(Math.max(0, testMinimum - 1)),
      }),
      { type: "setSaved" },
    )
    const fallbackPlan = failedFirstSet.session?.categoryPlans[0]

    expect(testPlan?.entry.level).toBe(1)
    expect(fallbackPlan?.testAttemptEntry?.level).toBe(1)
    expect(fallbackPlan?.testAttemptEntry?.sets).toHaveLength(1)
    expect(fallbackPlan?.entry.level).toBe(0)
    expect(fallbackPlan?.entry.sets).toHaveLength(0)
  })

  it("keeps next-level testing active after a passing first set", () => {
    const opened = reduceWorkout(
      reduceWorkout(
        createWorkoutState({ stored: testUnlockedState(), nowMs: now.getTime(), sessionId }),
        { type: "commonWarmupCompleted" },
      ),
      { type: "setDraftOpened" },
    )
    const testPlan = opened.session?.categoryPlans[0]
    const testMinimum =
      testPlan?.entry.metricRule.kind === "reps" ? testPlan.entry.metricRule.min : 1
    const savedFirstSet = reduceWorkout(
      reduceWorkout(opened, {
        field: "valueText",
        type: "draftTextChanged",
        value: String(testMinimum),
      }),
      { type: "setSaved" },
    )
    const activePlan = savedFirstSet.session?.categoryPlans[0]

    expect(activePlan?.testAttemptEntry).toBeUndefined()
    expect(activePlan?.entry.level).toBe(1)
    expect(activePlan?.entry.sets).toHaveLength(1)
  })

  it("keeps duration and per-side first-set passes in next-level testing", () => {
    const durationState = maybeSwitchFailedFirstTestSetToCurrentLevel(
      stateWithFirstTestSet({ category: "pull", set: { kind: "single", value: 100 } }),
    )
    const perSideState = maybeSwitchFailedFirstTestSetToCurrentLevel(
      stateWithFirstTestSet({
        category: "core",
        level: 0,
        set: { kind: "perSide", left: 100, right: 100 },
      }),
    )
    const durationPlan = durationState.session?.categoryPlans.find(
      (plan) => plan.categoryId === CategoryIdSchema.parse("pull"),
    )
    const perSidePlan = perSideState.session?.categoryPlans.find(
      (plan) => plan.categoryId === CategoryIdSchema.parse("core"),
    )

    expect(durationPlan?.testAttemptEntry).toBeUndefined()
    expect(perSidePlan?.testAttemptEntry).toBeUndefined()
  })

  it("does not switch terminal test entries to fallback work", () => {
    const terminalState = maybeSwitchFailedFirstTestSetToCurrentLevel(
      stateWithFirstTestSet({
        category: "verticalPush",
        level: 8,
        set: { kind: "single", value: 0 },
      }),
    )
    const terminalPlan = terminalState.session?.categoryPlans.find(
      (plan) => plan.categoryId === CategoryIdSchema.parse("verticalPush"),
    )

    expect(terminalPlan?.testAttemptEntry).toBeUndefined()
    expect(terminalPlan?.entry.level).toBe(8)
  })

  it("keeps mixed fallback helper stable without a session", () => {
    const state = reduceWorkout(
      createWorkoutState({
        stored: createCompletedOnboardingState(),
        nowMs: now.getTime(),
        sessionId,
      }),
      { type: "abandonConfirmed" },
    )

    expect(maybeSwitchFailedFirstTestSetToCurrentLevel(state)).toBe(state)
  })
})

type FirstTestSetInput = {
  readonly category: "squat" | "pull" | "core" | "verticalPush"
  readonly level?: number | undefined
  readonly set:
    | { readonly kind: "single"; readonly value: number }
    | { readonly kind: "perSide"; readonly left: number; readonly right: number }
}

function stateWithFirstTestSet(input: FirstTestSetInput): WorkoutState {
  const session = startWorkoutSession({
    stored: { ...testUnlockedState(), nextRoutine: input.category === "verticalPush" ? "B" : "A" },
    now,
    sessionId,
  })
  const currentCategoryIndex = session.categoryPlans.findIndex(
    (plan) => plan.categoryId === CategoryIdSchema.parse(input.category),
  )
  const categoryPlan = session.categoryPlans[currentCategoryIndex]
  if (categoryPlan === undefined) {
    throw new Error("missing test category plan")
  }
  const catalogLevel =
    input.level === undefined
      ? undefined
      : readLevel(readCatalogCategory(CategoryIdSchema.parse(input.category)), input.level)
  return {
    error: null,
    lastAnnouncement: null,
    nowMs: now.getTime(),
    session: {
      ...session,
      currentCategoryIndex,
      categoryPlans: session.categoryPlans.map((plan, index) =>
        index === currentCategoryIndex
          ? {
              ...plan,
              entry: entryWithSet(plan.entry, catalogLevel, input.set),
              testFallbackLevel: 0,
            }
          : plan,
      ),
    },
    setDraft: null,
    showAbandonDialog: false,
  }
}

function entryWithSet(
  entry: WorkoutState["session"] extends null
    ? never
    : NonNullable<WorkoutState["session"]>["categoryPlans"][number]["entry"],
  level: ReturnType<typeof readLevel> | undefined,
  set: FirstTestSetInput["set"],
) {
  return {
    ...entry,
    ...(level === undefined
      ? {}
      : { exerciseName: level.name, level: level.level, metricRule: level.metricRule }),
    sets: [recordedSet(set)],
  }
}

function recordedSet(set: FirstTestSetInput["set"]): SetRecord {
  const quality = { pain: false, form: "good", rom: "full" } as const
  return set.kind === "single"
    ? { kind: "single", value: set.value, quality }
    : { kind: "perSide", left: set.left, right: set.right, quality }
}

function testUnlockedState() {
  const stored = createCompletedOnboardingState()
  return {
    ...stored,
    completedSessions: Array.from({ length: 6 }, (_, index) => ({
      id: SessionIdSchema.parse(`99999999-9999-4999-8999-99999999999${index}`),
      routineId: "A" as const,
      completedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
      entries: [],
    })),
    progress: {
      ...stored.progress,
      squat: { ...stored.progress.squat, level: 0, status: "testUnlocked" as const },
    },
  }
}

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
  it("fallbacks only for a safe low first rep set", () => {
    const saved = saveFirstTestSet({ value: "0" })
    const plan = saved.session?.categoryPlans[0]

    expect(saved.error).toBeNull()
    expect(plan?.entry.level).toBe(0)
    expect(plan?.entry.sets).toHaveLength(0)
    expect(plan?.testFallbackLevel).toBeUndefined()
    expect(plan?.testAttemptEntry?.level).toBe(1)
    expect(plan?.testAttemptEntry?.sets).toHaveLength(1)
  })

  it("keeps current-level fallback sets from replacing the saved test attempt", () => {
    const opened = reduceWorkout(
      reduceWorkout(
        createWorkoutState({ stored: testUnlockedState(), nowMs: now.getTime(), sessionId }),
        { type: "commonWarmupCompleted" },
      ),
      { type: "setDraftOpened" },
    )
    const failedFirstSet = reduceWorkout(
      reduceWorkout(opened, {
        field: "valueText",
        type: "draftTextChanged",
        value: "0",
      }),
      { type: "setSaved" },
    )
    const fallbackSet = reduceWorkout(
      reduceWorkout(reduceWorkout(failedFirstSet, { type: "setDraftOpened" }), {
        field: "valueText",
        type: "draftTextChanged",
        value: "0",
      }),
      { type: "setSaved" },
    )
    const fallbackPlan = fallbackSet.session?.categoryPlans[0]

    expect(fallbackPlan?.testAttemptEntry?.level).toBe(1)
    expect(fallbackPlan?.testAttemptEntry?.sets).toHaveLength(1)
    expect(fallbackPlan?.entry.level).toBe(0)
    expect(fallbackPlan?.entry.sets).toHaveLength(1)
  })

  it.each([
    ["failed form", { value: "0", qualityChanges: [{ field: "form", value: true }] }],
    ["failed range of motion", { value: "0", qualityChanges: [{ field: "rom", value: true }] }],
    ["out-of-range RIR", { rir: "4", value: "0" }],
  ] as const)("does not fallback when low first reps have %s", (_caseName, input) => {
    const saved = saveFirstTestSet(input)
    const plan = saved.session?.categoryPlans[0]

    expect(saved.error).toBeNull()
    expect(plan?.entry.level).toBe(1)
    expect(plan?.entry.sets).toHaveLength(1)
    expect(plan?.testFallbackLevel).toBe(0)
    expect(plan?.testAttemptEntry).toBeUndefined()
  })

  it("keeps next-level testing active after a passing first set", () => {
    const savedFirstSet = saveFirstTestSet({ value: "100" })
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

type QualityChangeInput = {
  readonly field: "form" | "rom"
  readonly value: boolean
}

type FirstTestSaveInput = {
  readonly value: string
  readonly rir?: string | undefined
  readonly qualityChanges?: readonly QualityChangeInput[] | undefined
}

function saveFirstTestSet(input: FirstTestSaveInput): WorkoutState {
  const opened = reduceWorkout(
    reduceWorkout(
      createWorkoutState({ stored: testUnlockedState(), nowMs: now.getTime(), sessionId }),
      { type: "commonWarmupCompleted" },
    ),
    { type: "setDraftOpened" },
  )
  const withValue = reduceWorkout(opened, {
    field: "valueText",
    type: "draftTextChanged",
    value: input.value,
  })
  const withRir =
    input.rir === undefined
      ? withValue
      : reduceWorkout(withValue, {
          field: "rirText",
          type: "draftTextChanged",
          value: input.rir,
        })
  const withQuality = (input.qualityChanges ?? []).reduce(
    (state, change) =>
      reduceWorkout(state, {
        field: change.field,
        type: "qualityChanged",
        value: change.value,
      }),
    withRir,
  )
  return reduceWorkout(withQuality, { type: "setSaved" })
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

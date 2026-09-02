import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { startWorkoutSession } from "./engine"
import { reduceWorkout } from "./reducer"

const now = new Date("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("11111111-1111-4111-8111-111111111111")

describe("workout session reducer metric logging", () => {
  it("logs duration and per-side metrics without RIR and rep metrics with RIR", () => {
    const stored = createCompletedOnboardingState()
    const pullSession = startWorkoutSession({
      stored: { ...stored, nextRoutine: "B" },
      now,
      sessionId,
    })
    const pullState = reduceWorkout(
      reduceWorkout(
        {
          error: null,
          lastAnnouncement: null,
          nowMs: now.getTime(),
          session: { ...pullSession, currentCategoryIndex: 2 },
          setDraft: null,
          showAbandonDialog: false,
        },
        { type: "commonWarmupCompleted" },
      ),
      { type: "pullChecklistConfirmed" },
    )
    const draftOpen = reduceWorkout(pullState, { type: "setDraftOpened" })
    const savedDuration = reduceWorkout(
      reduceWorkout(draftOpen, { field: "valueText", type: "draftTextChanged", value: "30" }),
      { type: "setSaved" },
    )

    expect(savedDuration.session?.categoryPlans[2]?.entry.sets[0]).toMatchObject({
      kind: "single",
      value: 30,
    })
    expect(savedDuration.session?.categoryPlans[2]?.entry.sets[0]).not.toHaveProperty("rir")

    const coreState = createCoreDraftState()
    const savedPerSide = reduceWorkout(
      reduceWorkout(
        reduceWorkout(coreState, { field: "leftText", type: "draftTextChanged", value: "10" }),
        { field: "rightText", type: "draftTextChanged", value: "12" },
      ),
      { type: "setSaved" },
    )

    expect(
      savedPerSide.session?.categoryPlans[coreIndex(savedPerSide)]?.entry.sets[0],
    ).toMatchObject({
      kind: "perSide",
      left: 10,
      right: 12,
      rir: 2,
    })
  })
})

function createCoreDraftState() {
  const stored = createCompletedOnboardingState()
  const session = startWorkoutSession({
    stored: {
      ...stored,
      progress: {
        ...stored.progress,
        core: { ...stored.progress.core, level: 0, status: "active" },
      },
    },
    now,
    sessionId,
  })
  const currentCategoryIndex = session.categoryPlans.findIndex(
    (plan) => plan.categoryId === CategoryIdSchema.parse("core"),
  )
  return reduceWorkout(
    reduceWorkout(
      {
        error: null,
        lastAnnouncement: null,
        nowMs: now.getTime(),
        session: { ...session, currentCategoryIndex },
        setDraft: null,
        showAbandonDialog: false,
      },
      { type: "commonWarmupCompleted" },
    ),
    { type: "setDraftOpened" },
  )
}

function coreIndex(state: ReturnType<typeof createCoreDraftState>): number {
  return (
    state.session?.categoryPlans.findIndex(
      (plan) => plan.categoryId === CategoryIdSchema.parse("core"),
    ) ?? -1
  )
}

import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { startWorkoutSession } from "./engine"
import { createWorkoutState, reduceWorkout } from "./reducer"

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

  it("rejects malformed numeric input and records load plus failed form and ROM", () => {
    const opened = openFirstDraft()
    const malformed = reduceWorkout(
      reduceWorkout(opened, { field: "valueText", type: "draftTextChanged", value: "-1" }),
      { type: "setSaved" },
    )
    const badRir = reduceWorkout(
      reduceWorkout(
        reduceWorkout(opened, { field: "valueText", type: "draftTextChanged", value: "12" }),
        { field: "rirText", type: "draftTextChanged", value: "hard" },
      ),
      { type: "setSaved" },
    )
    const badLoad = reduceWorkout(
      reduceWorkout(
        reduceWorkout(opened, { field: "valueText", type: "draftTextChanged", value: "12" }),
        { field: "loadText", type: "draftTextChanged", value: "heavy" },
      ),
      { type: "setSaved" },
    )
    const withQuality = reduceWorkout(
      reduceWorkout(
        reduceWorkout(
          reduceWorkout(opened, { field: "valueText", type: "draftTextChanged", value: "12" }),
          { field: "loadText", type: "draftTextChanged", value: "10" },
        ),
        { field: "form", type: "qualityChanged", value: true },
      ),
      { field: "rom", type: "qualityChanged", value: true },
    )
    const saved = reduceWorkout(withQuality, { type: "setSaved" })

    expect(malformed.error).toMatch(/0 이상의 숫자/)
    expect(badRir.error).toMatch(/0 이상의 숫자/)
    expect(badLoad.error).toMatch(/0 이상의 숫자/)
    expect(saved.session?.categoryPlans[0]?.entry.sets[0]).toMatchObject({
      kind: "single",
      loadKg: 10,
      quality: { form: "failed", rom: "failed" },
    })
  })

  it("rejects incomplete per-side set values", () => {
    const opened = createCoreDraftState()
    const saved = reduceWorkout(
      reduceWorkout(opened, { field: "leftText", type: "draftTextChanged", value: "10" }),
      { type: "setSaved" },
    )

    expect(saved.error).toMatch(/0 이상의 숫자/)
  })
})

function openFirstDraft() {
  const stored = createCompletedOnboardingState()
  return reduceWorkout(
    reduceWorkout(
      createWorkoutState({
        stored: {
          ...stored,
          progress: {
            ...stored.progress,
            squat: { ...stored.progress.squat, level: 0, status: "active" },
          },
        },
        nowMs: now.getTime(),
        sessionId,
      }),
      {
        type: "commonWarmupCompleted",
      },
    ),
    { type: "setDraftOpened" },
  )
}

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

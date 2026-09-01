import { describe, expect, it } from "vitest"
import { CategoryIdSchema } from "../../domain/schemas"
import { createDefaultStoredState } from "../../storage/defaults"
import { MemoryStoragePort } from "../../storage/test-ports"
import {
  createAppStoreState,
  currentCategoryKey,
  reduceAppStore,
  selectAssessmentStep,
  selectCanUseDashboard,
  toStoredState,
} from "./index"

const now = "2026-09-02T00:00:00.000Z"
const pushId = CategoryIdSchema.parse("push")
const pullId = CategoryIdSchema.parse("pull")
const coreId = CategoryIdSchema.parse("core")
const squatId = CategoryIdSchema.parse("squat")
const hingeId = CategoryIdSchema.parse("hinge")
const verticalPushId = CategoryIdSchema.parse("verticalPush")
const passingSingleInput = {
  kind: "single",
  value: 15,
  pain: false,
  form: "good",
  rom: "full",
} as const

const completedAssessment = {
  status: "complete",
  currentCategoryId: null,
  nextLevelByCategory: {
    push: 0,
    pull: 0,
    squat: 0,
    hinge: 0,
    verticalPush: 0,
    core: 0,
  },
  lastSafeLevelByCategory: {
    push: 0,
    pull: 0,
    squat: 0,
    hinge: 0,
    verticalPush: 0,
    core: 0,
  },
} as const

const assessedProgress = {
  push: { categoryId: pushId, level: 0, status: "provisional" },
  pull: { categoryId: pullId, level: 0, status: "active" },
  squat: { categoryId: squatId, level: 0, status: "testUnlocked" },
  hinge: { categoryId: hingeId, level: 0, status: "provisional" },
  verticalPush: { categoryId: verticalPushId, level: 0, status: "active" },
  core: { categoryId: coreId, level: 0, status: "testUnlocked" },
} satisfies ReturnType<typeof createDefaultStoredState>["progress"]

describe("app store selectors and unsupported assessment submissions", () => {
  it("reports dashboard readiness after safety and every category has usable progress", () => {
    const completedStored = {
      ...createDefaultStoredState(),
      safety: { cleared: true, clearedAt: now },
      assessment: completedAssessment,
      progress: assessedProgress,
    } satisfies ReturnType<typeof createDefaultStoredState>
    const state = {
      ...createAppStoreState({ storage: new MemoryStoragePort() }),
      stored: completedStored,
    }

    expect(selectCanUseDashboard(state)).toBe(true)
    expect(selectAssessmentStep(state)).toEqual({ kind: "complete" })
  })

  it("keeps the dashboard gated when complete assessment has unassessed progress", () => {
    const state = {
      ...createAppStoreState({ storage: new MemoryStoragePort() }),
      stored: {
        ...createDefaultStoredState(),
        safety: { cleared: true, clearedAt: now },
        assessment: completedAssessment,
      },
    }

    expect(selectCanUseDashboard(state)).toBe(false)
    expect(selectAssessmentStep(state)).toEqual({ kind: "ready" })
  })

  it("keeps the dashboard gated when a progress category is missing or mismatched", () => {
    const missingProgressState = {
      ...createAppStoreState({ storage: new MemoryStoragePort() }),
      stored: {
        ...createDefaultStoredState(),
        safety: { cleared: true, clearedAt: now },
        assessment: completedAssessment,
        progress: {
          ...assessedProgress,
          core: undefined,
        },
      },
    } as unknown as ReturnType<typeof createAppStoreState>
    const mismatchedProgressState = {
      ...missingProgressState,
      stored: {
        ...missingProgressState.stored,
        progress: {
          ...assessedProgress,
          core: { ...assessedProgress.core, categoryId: pushId },
        },
      },
    } as unknown as ReturnType<typeof createAppStoreState>

    expect(selectCanUseDashboard(missingProgressState)).toBe(false)
    expect(selectAssessmentStep(missingProgressState)).toEqual({ kind: "ready" })
    expect(selectCanUseDashboard(mismatchedProgressState)).toBe(false)
    expect(selectAssessmentStep(mismatchedProgressState)).toEqual({ kind: "ready" })
  })

  it("treats stale in-progress assessment pointers as complete and rejects unknown category keys", () => {
    const state = {
      ...createAppStoreState({ storage: new MemoryStoragePort() }),
      stored: {
        ...createDefaultStoredState(),
        safety: { cleared: true, clearedAt: now },
        assessment: {
          ...createDefaultStoredState().assessment,
          status: "inProgress",
          currentCategoryId: null,
          nextLevelByCategory: {
            ...createDefaultStoredState().assessment.nextLevelByCategory,
            push: 99,
          },
        },
      },
    } satisfies ReturnType<typeof createAppStoreState>

    expect(selectAssessmentStep(state)).toEqual({ kind: "complete" })
    expect(() =>
      currentCategoryKey("unknown" as ReturnType<typeof CategoryIdSchema.parse>),
    ).toThrow(/unknown category key/)
  })

  it("ignores mismatched, ineligible, or terminal assessment submissions", () => {
    const started = reduceAppStore(
      {
        ...createAppStoreState({ storage: new MemoryStoragePort() }),
        stored: { ...createDefaultStoredState(), safety: { cleared: true, clearedAt: now } },
      },
      { type: "assessmentStarted" },
    )

    const mismatch = reduceAppStore(started, {
      type: "assessmentSetSubmitted",
      categoryId: pullId,
      level: 0,
      input: passingSingleInput,
    })
    const ineligible = reduceAppStore(started, {
      type: "assessmentSetSubmitted",
      categoryId: pushId,
      level: 99,
      input: passingSingleInput,
    })
    const unknownCategory = reduceAppStore(started, {
      type: "assessmentSetSubmitted",
      categoryId: "unknown" as ReturnType<typeof CategoryIdSchema.parse>,
      level: 0,
      input: passingSingleInput,
    })
    const notStarted = reduceAppStore(createAppStoreState({ storage: new MemoryStoragePort() }), {
      type: "assessmentSetSubmitted",
      categoryId: pushId,
      level: 0,
      input: passingSingleInput,
    })

    expect(mismatch).toEqual(started)
    expect(ineligible).toEqual(started)
    expect(unknownCategory).toEqual(started)
    expect(toStoredState(notStarted)).toEqual(createDefaultStoredState())
  })
})

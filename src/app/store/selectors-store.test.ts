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
const passingSingleInput = {
  kind: "single",
  value: 15,
  pain: false,
  form: "good",
  rom: "full",
} as const

describe("app store selectors and unsupported assessment submissions", () => {
  it("reports dashboard readiness only after safety and every category provisional result exist", () => {
    const completedStored = {
      ...createDefaultStoredState(),
      safety: { cleared: true, clearedAt: now },
      assessment: {
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
      },
      progress: {
        push: { categoryId: pushId, level: 0, status: "provisional" },
        pull: { categoryId: pullId, level: 0, status: "provisional" },
        squat: { categoryId: CategoryIdSchema.parse("squat"), level: 0, status: "provisional" },
        hinge: { categoryId: CategoryIdSchema.parse("hinge"), level: 0, status: "provisional" },
        verticalPush: {
          categoryId: CategoryIdSchema.parse("verticalPush"),
          level: 0,
          status: "provisional",
        },
        core: { categoryId: coreId, level: 0, status: "provisional" },
      },
    } satisfies ReturnType<typeof createDefaultStoredState>
    const state = {
      ...createAppStoreState({ storage: new MemoryStoragePort() }),
      stored: completedStored,
    }

    expect(selectCanUseDashboard(state)).toBe(true)
    expect(selectAssessmentStep(state)).toEqual({ kind: "complete" })
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

import { describe, expect, it } from "vitest"
import { EXERCISE_CATALOG } from "../../domain/catalog"
import { CategoryIdSchema } from "../../domain/schemas"
import { APP_STORAGE_KEY } from "../../storage"
import { createDefaultStoredState } from "../../storage/defaults"
import { MemoryStoragePort } from "../../storage/test-ports"
import {
  type AppStoreState,
  type AssessmentSetInput,
  createAppStoreState,
  reduceAppStore,
  selectAssessmentStep,
  toStoredState,
} from "./index"

const now = "2026-09-02T00:00:00.000Z"
const pushId = CategoryIdSchema.parse("push")
const pullId = CategoryIdSchema.parse("pull")
const coreId = CategoryIdSchema.parse("core")

const passingSingleInput: AssessmentSetInput = {
  kind: "single",
  value: 15,
  pain: false,
  form: "good",
  rom: "full",
}

describe("app store assessment reducer", () => {
  it("starts one category at a time in catalog order and only uses assessment-eligible levels", () => {
    const state = reduceAppStore(createAppStoreState({ storage: new MemoryStoragePort() }), {
      type: "safetyAnswersSubmitted",
      answers: {
        chestPain: false,
        faintingOrSevereDizziness: false,
        unusualShortnessOfBreath: false,
        cardiovascularMetabolicRenalDisease: false,
        recentInjury: false,
      },
      now,
    })

    const started = reduceAppStore(state, { type: "assessmentStarted" })

    expect(selectAssessmentStep(started)).toMatchObject({
      kind: "active",
      categoryId: pushId,
      level: 0,
    })
    expect(selectAssessmentStep(started)).toMatchObject({
      eligibleLevelCount: EXERCISE_CATALOG[0]?.levels.filter((level) => level.assessmentEligible)
        .length,
    })
  })

  it("stops the current category at the first miss and records the last safe provisional level", () => {
    const started = reduceAppStore(
      {
        ...createAppStoreState({ storage: new MemoryStoragePort() }),
        stored: { ...createDefaultStoredState(), safety: { cleared: true, clearedAt: now } },
      },
      { type: "assessmentStarted" },
    )
    const afterPass = reduceAppStore(started, {
      type: "assessmentSetSubmitted",
      categoryId: pushId,
      level: 0,
      input: passingSingleInput,
    })

    const afterMiss = reduceAppStore(afterPass, {
      type: "assessmentSetSubmitted",
      categoryId: pushId,
      level: 1,
      input: { ...passingSingleInput, value: 3 },
    })

    expect(toStoredState(afterMiss).progress.push).toMatchObject({
      categoryId: pushId,
      level: 0,
      status: "provisional",
    })
    expect(selectAssessmentStep(afterMiss)).toMatchObject({
      kind: "active",
      categoryId: pullId,
      level: 0,
    })
  })

  it("stops on pain, form failure, or limited range with level zero fallback", () => {
    const started = reduceAppStore(
      {
        ...createAppStoreState({ storage: new MemoryStoragePort() }),
        stored: { ...createDefaultStoredState(), safety: { cleared: true, clearedAt: now } },
      },
      { type: "assessmentStarted" },
    )

    const stopped = reduceAppStore(started, {
      type: "assessmentSetSubmitted",
      categoryId: pushId,
      level: 0,
      input: { ...passingSingleInput, pain: true, form: "failed", rom: "partial" },
    })

    expect(toStoredState(stopped).progress.push).toMatchObject({
      level: 0,
      status: "provisional",
    })
    expect(selectAssessmentStep(stopped)).toMatchObject({
      kind: "active",
      categoryId: pullId,
      level: 0,
    })
  })

  it("evaluates duration and per-side controlled inputs with the proper metric fields", () => {
    const base: AppStoreState = {
      ...createAppStoreState({ storage: new MemoryStoragePort() }),
      stored: {
        ...createDefaultStoredState(),
        safety: { cleared: true, clearedAt: now },
        assessment: {
          ...createDefaultStoredState().assessment,
          status: "inProgress" as const,
        },
      },
    }
    const pullState = {
      ...base,
      stored: {
        ...base.stored,
        assessment: { ...base.stored.assessment, currentCategoryId: pullId },
      },
    }
    const coreState = {
      ...base,
      stored: {
        ...base.stored,
        assessment: { ...base.stored.assessment, currentCategoryId: coreId },
      },
    }

    const afterPull = reduceAppStore(pullState, {
      type: "assessmentSetSubmitted",
      categoryId: pullId,
      level: 0,
      input: { ...passingSingleInput, value: 30 },
    })
    const afterCore = reduceAppStore(coreState, {
      type: "assessmentSetSubmitted",
      categoryId: coreId,
      level: 0,
      input: {
        kind: "perSide",
        left: 10,
        right: 10,
        pain: false,
        form: "good",
        rom: "full",
      },
    })

    expect(toStoredState(afterPull).progress.pull.status).toBe("provisional")
    expect(selectAssessmentStep(afterPull)).toMatchObject({
      categoryId: CategoryIdSchema.parse("squat"),
    })
    expect(selectAssessmentStep(afterCore)).toMatchObject({ categoryId: coreId, level: 1 })
  })

  it("persists assessment progress and resumes the same step after reload", () => {
    const storage = new MemoryStoragePort()
    const state = reduceAppStore(
      {
        ...createAppStoreState({ storage }),
        stored: { ...createDefaultStoredState(), safety: { cleared: true, clearedAt: now } },
      },
      { type: "assessmentStarted" },
    )
    const advanced = reduceAppStore(state, {
      type: "assessmentSetSubmitted",
      categoryId: pushId,
      level: 0,
      input: passingSingleInput,
    })
    storage.setItem(APP_STORAGE_KEY, JSON.stringify(toStoredState(advanced)))

    const reloaded = createAppStoreState({ storage })

    expect(selectAssessmentStep(reloaded)).toMatchObject({
      kind: "active",
      categoryId: pushId,
      level: 1,
    })
    expect(JSON.stringify(toStoredState(reloaded))).not.toContain("chestPain")
  })
})

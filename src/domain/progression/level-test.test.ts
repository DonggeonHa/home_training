import { describe, expect, it } from "vitest"
import type { CategoryProgress, MetricRule, SessionEntry, SessionId, SetRecord } from "../contracts"
import { CategoryIdSchema, SessionIdSchema } from "../schemas"
import { evaluateLevelTest } from "./progression"

const pushId = CategoryIdSchema.parse("push")
const sessionId = (value: string): SessionId => SessionIdSchema.parse(value)
const firstSessionId = sessionId("11111111-1111-4111-8111-111111111111")
const secondSessionId = sessionId("22222222-2222-4222-8222-222222222222")

const repsRule: MetricRule = {
  kind: "reps",
  min: 10,
  max: 15,
  sets: 3,
  laterality: "none",
  rir: { min: 1, max: 2 },
}

const perSideRule: MetricRule = {
  kind: "reps",
  min: 5,
  max: 8,
  sets: 3,
  laterality: "perSide",
  rir: { min: 1, max: 2 },
}

const progress = (): CategoryProgress => ({
  categoryId: pushId,
  level: 3,
  status: "testUnlocked",
  qualifiedSessionIds: [firstSessionId, secondSessionId],
})

const singleSet = (value: number): SetRecord => ({
  kind: "single",
  value,
  quality: { pain: false, form: "good", rom: "full" },
})

const perSideSet = (left: number, right: number): SetRecord => ({
  kind: "perSide",
  left,
  right,
  quality: { pain: false, form: "good", rom: "full" },
})

const entry = (metricRule: MetricRule, sets: readonly SetRecord[]): SessionEntry => ({
  categoryId: pushId,
  level: 3,
  exerciseName: "일반 푸시업",
  metricRule,
  sets,
})

describe("evaluateLevelTest", () => {
  it("promotes when all next-level sets reach the minimum", () => {
    // Given: an unlocked category testing the next level.
    const testEntry = entry({ ...repsRule, min: 8, max: 12 }, [
      singleSet(8),
      singleSet(8),
      singleSet(8),
    ])

    // When: the test reaches the next-level minimum for all three sets.
    const result = evaluateLevelTest({
      progress: progress(),
      currentLevel: 3,
      nextLevel: 4,
      entry: testEntry,
    })

    // Then: the category promotes and clears qualifier IDs.
    expect(result).toEqual({
      kind: "promoted",
      progress: { categoryId: pushId, level: 4, status: "active", qualifiedSessionIds: [] },
    })
  })

  it("preserves test-unlocked progress when the next-level test fails", () => {
    // Given: a test-unlocked category and a later set below the next-level minimum.
    const testEntry = entry({ ...repsRule, min: 8, max: 12 }, [
      singleSet(8),
      singleSet(7),
      singleSet(8),
    ])
    const currentProgress = progress()

    // When: the test fails.
    const result = evaluateLevelTest({
      progress: currentProgress,
      currentLevel: 3,
      nextLevel: 4,
      entry: testEntry,
    })

    // Then: current level and unlocked status are preserved.
    expect(result).toEqual({
      kind: "failed",
      reason: "set-below-minimum",
      progress: currentProgress,
    })
  })

  it("returns a mixed-routine fallback when the first next-level set is too short", () => {
    // Given: the first set cannot reach the next-level minimum.
    const testEntry = entry({ ...repsRule, min: 8, max: 12 }, [
      singleSet(3),
      singleSet(10),
      singleSet(10),
    ])
    const currentProgress = progress()

    // When: the level test is evaluated.
    const result = evaluateLevelTest({
      progress: currentProgress,
      currentLevel: 3,
      nextLevel: 4,
      entry: testEntry,
    })

    // Then: it does not demote and tells the UI to mix next-level and current-level work.
    expect(result).toEqual({
      kind: "mixedFallback",
      reason: "first-set-below-minimum",
      progress: currentProgress,
      testedLevel: 4,
      fallbackLevel: 3,
    })
  })

  it("returns a mixed-routine fallback when the first per-side test set is too short", () => {
    // Given: one side misses the minimum on the first next-level set.
    const testEntry = entry(perSideRule, [perSideSet(4, 8), perSideSet(8, 8), perSideSet(8, 8)])
    const currentProgress = progress()

    // When: the level test is evaluated.
    const result = evaluateLevelTest({
      progress: currentProgress,
      currentLevel: 5,
      nextLevel: 6,
      entry: testEntry,
    })

    // Then: it returns the same no-demotion mixed fallback.
    expect(result).toEqual({
      kind: "mixedFallback",
      reason: "first-set-below-minimum",
      progress: currentProgress,
      testedLevel: 6,
      fallbackLevel: 5,
    })
  })
})

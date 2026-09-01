import { describe, expect, it } from "vitest"
import type { CategoryProgress, MetricRule, SessionEntry, SetRecord } from "../contracts"
import { CategoryIdSchema } from "../schemas"
import { confirmAssessmentProvisional, evaluateAssessment } from "./assessment"

const pushId = CategoryIdSchema.parse("push")

const levelRule = (min: number, max: number): MetricRule => ({
  kind: "reps",
  min,
  max,
  sets: 3,
  laterality: "none",
  rir: { min: 1, max: 2 },
})

const set = (value: number): SetRecord => ({
  kind: "single",
  value,
  rir: 2,
  quality: { pain: false, form: "good", rom: "full" },
})

const entry = (level: number, rule: MetricRule, sets: readonly SetRecord[]): SessionEntry => ({
  categoryId: pushId,
  level,
  exerciseName: "assessment",
  metricRule: rule,
  sets,
})

describe("evaluateAssessment", () => {
  it("returns the highest passed eligible level as provisional", () => {
    // Given: assessment attempts through a conservative eligible cap.
    const attempts = [
      entry(0, levelRule(15, 15), [set(15), set(15), set(15)]),
      entry(1, levelRule(15, 15), [set(15), set(15), set(15)]),
      entry(2, levelRule(12, 15), [set(11), set(15), set(15)]),
    ]

    // When: assessment is evaluated with level 1 as the cap.
    const result = evaluateAssessment({ categoryId: pushId, attempts, maxEligibleLevel: 1 })

    // Then: level 1 becomes provisional and higher attempts are ignored by the cap.
    expect(result).toEqual({
      kind: "provisional",
      progress: { categoryId: pushId, level: 1, status: "provisional", qualifiedSessionIds: [] },
    })
  })

  it("falls back to level zero when no eligible level passes", () => {
    // Given: all eligible attempts miss their minimum.
    const attempts = [entry(0, levelRule(15, 15), [set(12), set(15), set(15)])]

    // When: assessment is evaluated.
    const result = evaluateAssessment({ categoryId: pushId, attempts, maxEligibleLevel: 3 })

    // Then: the user starts at a conservative active fallback.
    expect(result).toEqual({
      kind: "fallback",
      progress: { categoryId: pushId, level: 0, status: "active", qualifiedSessionIds: [] },
    })
  })
})

describe("confirmAssessmentProvisional", () => {
  it("confirms a provisional level after a successful normal session", () => {
    // Given: a provisional level and a successful first normal session.
    const provisional: CategoryProgress = {
      categoryId: pushId,
      level: 1,
      status: "provisional",
      qualifiedSessionIds: [],
    }
    const normalSession = entry(1, levelRule(15, 15), [set(15), set(15), set(15)])

    // When: provisional confirmation is evaluated.
    const result = confirmAssessmentProvisional({ progress: provisional, entry: normalSession })

    // Then: the same level becomes active.
    expect(result).toEqual({
      kind: "confirmed",
      progress: { categoryId: pushId, level: 1, status: "active", qualifiedSessionIds: [] },
    })
  })

  it("falls back one level when the first normal session cannot confirm provisional work", () => {
    // Given: a provisional level and an unsuccessful normal session.
    const provisional: CategoryProgress = {
      categoryId: pushId,
      level: 2,
      status: "provisional",
      qualifiedSessionIds: [],
    }
    const normalSession = entry(2, levelRule(12, 15), [set(12), set(11), set(12)])

    // When: confirmation fails.
    const result = confirmAssessmentProvisional({ progress: provisional, entry: normalSession })

    // Then: the active level falls back conservatively without going below zero.
    expect(result).toEqual({
      kind: "fallback",
      reason: "provisional-not-confirmed",
      progress: { categoryId: pushId, level: 1, status: "active", qualifiedSessionIds: [] },
    })
  })
})

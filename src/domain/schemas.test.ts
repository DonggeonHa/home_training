import { describe, expect, it } from "vitest"
import { createDefaultStoredState } from "../storage/defaults"
import { AppStateSchema, CategoryIdSchema, MetricRuleSchema } from "./schemas"

describe("domain boundary schemas", () => {
  it("rejects progress records whose categoryId does not match their AppState progress key", () => {
    // Given: an otherwise valid app state with two valid category IDs swapped at the progress boundary.
    const {
      activeSession: _activeSession,
      assessment: _assessment,
      ...defaultAppState
    } = createDefaultStoredState()
    const state = {
      ...defaultAppState,
      progress: {
        ...defaultAppState.progress,
        push: { ...defaultAppState.progress.push, categoryId: "pull" },
      },
    }

    // When: the untrusted state crosses the domain AppState boundary.
    const result = AppStateSchema.safeParse(state)

    // Then: the boundary rejects the key/category mismatch at the offending categoryId path.
    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        code: "custom",
        path: ["progress", "push", "categoryId"],
        message: "Progress key push requires categoryId push",
      }),
    )
  })

  it("parses reps, duration, tempo reps, per-side, and terminal metric rules", () => {
    const repRule = MetricRuleSchema.safeParse({
      kind: "reps",
      min: 10,
      max: 15,
      sets: 3,
      laterality: "none",
      rir: { min: 1, max: 2 },
    })
    const durationRule = MetricRuleSchema.safeParse({
      kind: "duration",
      minSeconds: 30,
      maxSeconds: 45,
      sets: 3,
      laterality: "none",
    })
    const tempoRule = MetricRuleSchema.safeParse({
      kind: "tempoReps",
      min: 5,
      max: 5,
      tempoSeconds: 5,
      sets: 3,
      laterality: "none",
    })
    const perSideRule = MetricRuleSchema.safeParse({
      kind: "reps",
      min: 5,
      max: 8,
      sets: 3,
      laterality: "perSide",
      rir: { min: 1, max: 2 },
    })
    const terminalRule = MetricRuleSchema.safeParse({
      kind: "terminal",
      label: "상급 목표",
      laterality: "none",
    })

    expect(repRule.success).toBe(true)
    expect(durationRule.success).toBe(true)
    expect(tempoRule.success).toBe(true)
    expect(perSideRule.success).toBe(true)
    expect(terminalRule.success).toBe(true)
  })

  it("rejects invalid metric combinations at the boundary", () => {
    expect(
      MetricRuleSchema.safeParse({
        kind: "duration",
        minSeconds: 30,
        maxSeconds: 45,
        sets: 3,
        laterality: "none",
        rir: { min: 1, max: 2 },
      }).success,
    ).toBe(false)

    expect(
      MetricRuleSchema.safeParse({
        kind: "reps",
        min: 12,
        max: 10,
        sets: 3,
        laterality: "none",
      }).success,
    ).toBe(false)

    expect(
      MetricRuleSchema.safeParse({
        kind: "reps",
        min: 10,
        max: 15,
        sets: 2,
        laterality: "none",
      }).success,
    ).toBe(false)
  })

  it("rejects RIR gate values outside integer zero through five", () => {
    expect(
      MetricRuleSchema.safeParse({
        kind: "reps",
        min: 10,
        max: 15,
        sets: 3,
        laterality: "none",
        rir: { min: -1, max: 2 },
      }).success,
    ).toBe(false)

    expect(
      MetricRuleSchema.safeParse({
        kind: "reps",
        min: 10,
        max: 15,
        sets: 3,
        laterality: "none",
        rir: { min: 1, max: 6 },
      }).success,
    ).toBe(false)

    expect(
      MetricRuleSchema.safeParse({
        kind: "reps",
        min: 10,
        max: 15,
        sets: 3,
        laterality: "none",
        rir: { min: 1.5, max: 2 },
      }).success,
    ).toBe(false)
  })

  it("reports representative boundary QA cases as binary pass/fail results", () => {
    const cases = [
      {
        name: "valid rep",
        passed: MetricRuleSchema.safeParse({
          kind: "reps",
          min: 10,
          max: 15,
          sets: 3,
          laterality: "none",
          rir: { min: 1, max: 2 },
        }).success,
      },
      {
        name: "valid duration",
        passed: MetricRuleSchema.safeParse({
          kind: "duration",
          minSeconds: 30,
          maxSeconds: 45,
          sets: 3,
          laterality: "none",
        }).success,
      },
      {
        name: "valid tempo",
        passed: MetricRuleSchema.safeParse({
          kind: "tempoReps",
          min: 5,
          max: 5,
          tempoSeconds: 5,
          sets: 3,
          laterality: "none",
        }).success,
      },
      {
        name: "valid per-side",
        passed: MetricRuleSchema.safeParse({
          kind: "reps",
          min: 5,
          max: 8,
          sets: 3,
          laterality: "perSide",
          rir: { min: 1, max: 2 },
        }).success,
      },
      {
        name: "reject malformed unknown category",
        passed: !CategoryIdSchema.safeParse("unknown").success,
      },
    ]

    expect(cases).toEqual([
      { name: "valid rep", passed: true },
      { name: "valid duration", passed: true },
      { name: "valid tempo", passed: true },
      { name: "valid per-side", passed: true },
      { name: "reject malformed unknown category", passed: true },
    ])
  })
})

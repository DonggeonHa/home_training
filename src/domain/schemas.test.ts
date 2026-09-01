import { describe, expect, it } from "vitest"
import { CategoryIdSchema, MetricRuleSchema, SetRecordSchema } from "./schemas"

describe("domain boundary schemas", () => {
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

  it("parses set records by matching metric laterality", () => {
    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 2,
        loadKg: 10,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "perSide",
        left: 8,
        right: 8,
        rir: 2,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        left: 8,
        right: 8,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(false)
  })

  it("keeps normal logged RIR values bounded to integer zero through five", () => {
    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 0,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 5,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(true)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: -1,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(false)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 6,
        quality: { pain: false, form: "good", rom: "full" },
      }).success,
    ).toBe(false)

    expect(
      SetRecordSchema.safeParse({
        kind: "single",
        value: 12,
        rir: 2.5,
        quality: { pain: false, form: "good", rom: "full" },
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

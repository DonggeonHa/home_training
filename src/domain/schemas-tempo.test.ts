import { describe, expect, it } from "vitest"
import { MetricRuleSchema } from "./schemas"

describe("tempo reps boundary schema", () => {
  it("parses tempo reps as min and max ranges and rejects reversed bounds", () => {
    expect(
      MetricRuleSchema.safeParse({
        kind: "tempoReps",
        min: 5,
        max: 5,
        tempoSeconds: 5,
        sets: 3,
        laterality: "none",
      }).success,
    ).toBe(true)

    expect(
      MetricRuleSchema.safeParse({
        kind: "tempoReps",
        min: 12,
        max: 15,
        tempoSeconds: 3,
        sets: 3,
        laterality: "none",
      }).success,
    ).toBe(true)

    expect(
      MetricRuleSchema.safeParse({
        kind: "tempoReps",
        min: 15,
        max: 12,
        tempoSeconds: 3,
        sets: 3,
        laterality: "none",
      }).success,
    ).toBe(false)
  })
})

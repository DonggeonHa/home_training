import { describe, expect, it } from "vitest"
import type { CategoryProgress, MetricRule, SessionEntry, SessionId, SetRecord } from "../contracts"
import { CategoryIdSchema, SessionIdSchema } from "../schemas"
import { evaluateSessionQualification, getRemainingConditions } from "./progression"

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

const progress = (): CategoryProgress => ({
  categoryId: pushId,
  level: 3,
  status: "active",
  qualifiedSessionIds: [],
})

const singleSet = (value: number, rir: number | undefined = 2): SetRecord => ({
  kind: "single",
  value,
  rir,
  quality: { pain: false, form: "good", rom: "full" },
})

const entry = (metricRule: MetricRule, sets: readonly SetRecord[]): SessionEntry => ({
  categoryId: pushId,
  level: 3,
  exerciseName: "일반 푸시업",
  metricRule,
  sets,
})

describe("evaluateSessionQualification edge cases", () => {
  it("rejects final-set RIR 0 and RIR 3 for rep gates", () => {
    // Given: two sessions hit reps but miss the final RIR range on opposite sides.
    const rirZeroEntry = entry(repsRule, [singleSet(15), singleSet(15), singleSet(15, 0)])
    const rirThreeEntry = entry(repsRule, [singleSet(15), singleSet(15), singleSet(15, 3)])

    // When: qualification is evaluated for each final RIR value.
    const rirZero = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: rirZeroEntry,
    })
    const rirThree = evaluateSessionQualification({
      sessionId: secondSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: rirThreeEntry,
    })

    // Then: both fail with the same final RIR reason.
    expect(rirZero.kind === "notQualified" ? rirZero.reasons : []).toContain(
      "final-rir-out-of-range",
    )
    expect(rirThree.kind === "notQualified" ? rirThree.reasons : []).toContain(
      "final-rir-out-of-range",
    )
  })

  it("rejects limited form, partial ROM, and pain", () => {
    // Given: otherwise qualifying sessions with one quality failure each.
    const limitedForm = entry(repsRule, [
      singleSet(15),
      { ...singleSet(15), quality: { pain: false, form: "limited", rom: "full" } },
      singleSet(15),
    ])
    const partialRom = entry(repsRule, [
      singleSet(15),
      { ...singleSet(15), quality: { pain: false, form: "good", rom: "partial" } },
      singleSet(15),
    ])
    const pain = entry(repsRule, [
      singleSet(15),
      { ...singleSet(15), quality: { pain: true, form: "good", rom: "full" } },
      singleSet(15),
    ])

    // When: each session is evaluated.
    const formResult = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: limitedForm,
    })
    const romResult = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: partialRom,
    })
    const painResult = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: pain,
    })

    // Then: exact quality reasons block qualification.
    expect(formResult.kind === "notQualified" ? formResult.reasons : []).toContain("form-not-good")
    expect(romResult.kind === "notQualified" ? romResult.reasons : []).toContain("rom-not-full")
    expect(painResult.kind === "notQualified" ? painResult.reasons : []).toContain(
      "concerning-pain",
    )
  })

  it("reports missing required sets before qualification", () => {
    // Given: a post-adaptation entry logs only two of three required sets.
    const incompleteEntry = entry(repsRule, [singleSet(15), singleSet(15)])

    // When: qualification is evaluated.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: incompleteEntry,
    })

    // Then: missing set count and missing final RIR are both explicit.
    expect(result).toEqual({
      kind: "notQualified",
      reasons: ["missing-required-set", "final-rir-out-of-range"],
      remainingConditions: [
        { kind: "required-set-count", required: 3, current: 2 },
        { kind: "final-rir", min: 1, max: 2, current: null },
      ],
    })
  })

  it("qualifies rep metrics that do not define an RIR gate", () => {
    // Given: a repetition rule without a final-set RIR gate.
    const noRirEntry = entry({ kind: "reps", min: 10, max: 15, sets: 3, laterality: "none" }, [
      singleSet(15, undefined),
      singleSet(15, undefined),
      singleSet(15, undefined),
    ])

    // When: qualification is evaluated.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: noRirEntry,
    })

    // Then: the absence of an RIR gate means RIR is not required.
    expect(result).toEqual({
      kind: "qualified",
      qualifiedSessionIds: [firstSessionId],
      status: "active",
    })
  })

  it("does not qualify terminal levels", () => {
    // Given: a terminal level has no computable promotion gate.
    const terminalEntry = entry({ kind: "terminal", label: "상급 목표", laterality: "none" }, [
      singleSet(1),
      singleSet(1),
      singleSet(1),
    ])

    // When: qualification is evaluated.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: terminalEntry,
    })

    // Then: the terminal reason blocks qualification.
    expect(result).toEqual({
      kind: "notQualified",
      reasons: ["terminal-level"],
      remainingConditions: [],
    })
  })

  it("rejects malformed metric and set records at exhaustive guards", () => {
    // Given: impossible discriminants reach the engine from malformed state.
    const malformedMetric = entry(JSON.parse('{"kind":"mystery"}'), [singleSet(1)])
    const malformedSet = entry(repsRule, [
      JSON.parse('{"kind":"mystery","quality":{"pain":false,"form":"good","rom":"full"}}'),
    ])

    // When / Then: exhaustive guards reject both malformed variants.
    expect(() => getRemainingConditions(malformedMetric)).toThrow("Unexpected domain variant")
    expect(() => getRemainingConditions(malformedSet)).toThrow("Unexpected domain variant")
  })
})

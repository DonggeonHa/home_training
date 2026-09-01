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

const perSideRule: MetricRule = {
  kind: "reps",
  min: 5,
  max: 8,
  sets: 3,
  laterality: "perSide",
  rir: { min: 1, max: 2 },
}

const durationRule: MetricRule = {
  kind: "duration",
  minSeconds: 30,
  maxSeconds: 45,
  sets: 3,
  laterality: "none",
}

const tempoRule: MetricRule = {
  kind: "tempoReps",
  min: 5,
  max: 5,
  tempoSeconds: 5,
  sets: 3,
  laterality: "none",
  rir: { min: 1, max: 2 },
}

const progress = (qualifiedSessionIds: readonly SessionId[] = []): CategoryProgress => ({
  categoryId: pushId,
  level: 3,
  status: qualifiedSessionIds.length >= 2 ? "testUnlocked" : "active",
  qualifiedSessionIds,
})

const singleSet = (value: number, rir: number | undefined = 2): SetRecord => ({
  kind: "single",
  value,
  rir,
  quality: { pain: false, form: "good", rom: "full" },
})

const perSideSet = (left: number, right: number, rir = 2): SetRecord => ({
  kind: "perSide",
  left,
  right,
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

describe("evaluateSessionQualification", () => {
  it("blocks qualification before the sixth adaptation session is complete", () => {
    // Given: five completed sessions and a current session that otherwise reaches the upper bound.
    const qualifyingEntry = entry(repsRule, [singleSet(15), singleSet(15), singleSet(15)])

    // When: qualification is evaluated inside the adaptation period.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 5,
      progress: progress(),
      entry: qualifyingEntry,
    })

    // Then: the session stays in adaptation and does not add a qualifier.
    expect(result).toEqual({
      kind: "adaptation",
      reason: "adaptation-period",
      prescribedSetCount: 2,
    })
  })

  it("allows qualification after the first six sessions are complete", () => {
    // Given: six completed sessions and a current session that reaches every gate.
    const qualifyingEntry = entry(repsRule, [singleSet(15), singleSet(15), singleSet(15)])

    // When: qualification is evaluated after adaptation.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 6,
      progress: progress(),
      entry: qualifyingEntry,
    })

    // Then: the distinct session ID is retained as the first qualifier.
    expect(result).toEqual({
      kind: "qualified",
      qualifiedSessionIds: [firstSessionId],
      status: "active",
    })
  })

  it("unlocks the test after two distinct qualifying session IDs", () => {
    // Given: one existing qualifying session and a different qualifying session.
    const qualifyingEntry = entry(repsRule, [singleSet(15), singleSet(15), singleSet(15)])

    // When: the new distinct session qualifies.
    const result = evaluateSessionQualification({
      sessionId: secondSessionId,
      completedSessionCount: 7,
      progress: progress([firstSessionId]),
      entry: qualifyingEntry,
    })

    // Then: two distinct qualifiers unlock the next-level test.
    expect(result).toEqual({
      kind: "testUnlocked",
      qualifiedSessionIds: [firstSessionId, secondSessionId],
      status: "testUnlocked",
    })
  })

  it("rejects duplicate qualifying session IDs", () => {
    // Given: a session ID already counted as a qualifier.
    const qualifyingEntry = entry(repsRule, [singleSet(15), singleSet(15), singleSet(15)])

    // When: the same ID is evaluated again.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress([firstSessionId]),
      entry: qualifyingEntry,
    })

    // Then: the duplicate is rejected without changing the qualifier list.
    expect(result).toEqual({
      kind: "notQualified",
      reasons: ["duplicate-session-id"],
      remainingConditions: [{ kind: "distinct-session", required: 2, current: 1 }],
    })
  })

  it("reports the exact remaining repetitions for a 15 15 14 result", () => {
    // Given: only the final set misses the upper-bound target by one rep.
    const almostEntry = entry(repsRule, [singleSet(15), singleSet(15), singleSet(14)])

    // When: remaining conditions are computed.
    const result = getRemainingConditions(almostEntry)

    // Then: display data names the missing third-set rep.
    expect(result).toEqual([{ kind: "set-upper-bound", setIndex: 2, required: 15, current: 14 }])
  })

  it("requires both sides to reach the per-side upper bound", () => {
    // Given: the right side is short on the final set.
    const shortSideEntry = entry(perSideRule, [
      perSideSet(8, 8),
      perSideSet(8, 8),
      perSideSet(8, 7),
    ])

    // When: qualification is evaluated.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: shortSideEntry,
    })

    // Then: the short side is named without counting the stronger side.
    expect(result).toEqual({
      kind: "notQualified",
      reasons: ["set-below-upper-bound"],
      remainingConditions: [
        { kind: "side-upper-bound", setIndex: 2, side: "right", required: 8, current: 7 },
      ],
    })
  })

  it("qualifies duration metrics without requiring RIR", () => {
    // Given: a duration entry has no RIR values.
    const durationEntry = entry(durationRule, [
      singleSet(45, undefined),
      singleSet(45, undefined),
      singleSet(45, undefined),
    ])

    // When: qualification is evaluated.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: durationEntry,
    })

    // Then: duration qualifies through seconds, form, ROM, and pain only.
    expect(result).toEqual({
      kind: "qualified",
      qualifiedSessionIds: [firstSessionId],
      status: "active",
    })
  })

  it("uses tempo repetition upper bounds and final RIR gates", () => {
    // Given: one tempo set misses the prescribed tempo repetition count.
    const tempoEntry = entry(tempoRule, [singleSet(5), singleSet(4), singleSet(5)])

    // When: qualification is evaluated.
    const result = evaluateSessionQualification({
      sessionId: firstSessionId,
      completedSessionCount: 7,
      progress: progress(),
      entry: tempoEntry,
    })

    // Then: tempo reps fail on the same upper-bound contract.
    expect(result).toEqual({
      kind: "notQualified",
      reasons: ["set-below-upper-bound"],
      remainingConditions: [{ kind: "set-upper-bound", setIndex: 1, required: 5, current: 4 }],
    })
  })
})

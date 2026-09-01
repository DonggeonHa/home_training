import { describe, expect, it } from "vitest"
import type { CompletedSession, MetricRule, SessionEntry, SessionId, SetRecord } from "../contracts"
import { CategoryIdSchema, SessionIdSchema } from "../schemas"
import { getLatestEntry, getLevelTimeline, getRawUnitChartSeries, getSameLevelPr } from "./history"

const pushId = CategoryIdSchema.parse("push")
const pullId = CategoryIdSchema.parse("pull")
const sessionId = (value: string): SessionId => SessionIdSchema.parse(value)

const repsRule: MetricRule = { kind: "reps", min: 10, max: 15, sets: 3, laterality: "none" }
const secondsRule: MetricRule = {
  kind: "duration",
  minSeconds: 30,
  maxSeconds: 45,
  sets: 3,
  laterality: "none",
}
const sideRule: MetricRule = { kind: "reps", min: 5, max: 8, sets: 3, laterality: "perSide" }

const single = (value: number, loadKg?: number): SetRecord => ({
  kind: "single",
  value,
  loadKg,
  quality: { pain: false, form: "good", rom: "full" },
})

const side = (left: number, right: number): SetRecord => ({
  kind: "perSide",
  left,
  right,
  quality: { pain: false, form: "good", rom: "full" },
})

const entry = (
  categoryId: typeof pushId | typeof pullId,
  level: number,
  metricRule: MetricRule,
  sets: readonly SetRecord[],
): SessionEntry => ({
  categoryId,
  level,
  exerciseName: "history",
  metricRule,
  sets,
})

const session = (
  id: SessionId,
  completedAt: string,
  entries: readonly SessionEntry[],
): CompletedSession => ({
  id,
  routineId: "A",
  completedAt,
  entries,
})

describe("history statistics", () => {
  it("returns not found when a category has no records", () => {
    // Given: no completed sessions contain the requested category.
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pullId, 0, secondsRule, [single(30), single(30), single(30)]),
      ]),
    ]

    // When: latest and PR records are requested.
    const latest = getLatestEntry({ sessions, categoryId: pushId })
    const pr = getSameLevelPr({ sessions, categoryId: pushId, level: 0 })

    // Then: both functions report an empty category history.
    expect(latest).toEqual({ kind: "notFound" })
    expect(pr).toEqual({ kind: "notFound" })
  })

  it("returns the latest record for a category", () => {
    // Given: two records for the same category in chronological order.
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pushId, 2, repsRule, [single(12), single(12), single(12)]),
      ]),
      session(sessionId("22222222-2222-4222-8222-222222222222"), "2026-01-03T00:00:00.000Z", [
        entry(pushId, 2, repsRule, [single(15), single(15), single(14)]),
      ]),
    ]

    // When: the latest entry is requested.
    const result = getLatestEntry({ sessions, categoryId: pushId })

    // Then: the newest dated entry is returned.
    expect(result).toEqual({
      kind: "found",
      sessionId: sessions[1]?.id,
      completedAt: "2026-01-03T00:00:00.000Z",
      entry: sessions[1]?.entries[0],
    })
  })

  it("keeps same-level PRs separated by reps, seconds, load, and per-side units", () => {
    // Given: same-level history contains several incompatible units.
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pushId, 2, repsRule, [single(12, 5), single(12, 5), single(12, 5)]),
        entry(pullId, 0, secondsRule, [single(30), single(30), single(30)]),
      ]),
      session(sessionId("22222222-2222-4222-8222-222222222222"), "2026-01-02T00:00:00.000Z", [
        entry(pushId, 2, repsRule, [single(15, 5), single(15, 5), single(14, 5)]),
        entry(pushId, 2, sideRule, [side(8, 7), side(8, 8), side(8, 8)]),
      ]),
    ]

    // When: PRs are computed for a category and level.
    const result = getSameLevelPr({ sessions, categoryId: pushId, level: 2 })

    // Then: each raw unit stays in its own bucket.
    expect(result).toEqual({
      kind: "found",
      bestSingleValue: { unit: "reps", value: 15 },
      bestLoadKg: { unit: "kg", value: 5 },
      bestPerSideValue: { unit: "perSideReps", left: 8, right: 8 },
    })
  })

  it("builds a level timeline from category records", () => {
    // Given: category entries at changing levels.
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pushId, 1, repsRule, [single(15), single(15), single(15)]),
      ]),
      session(sessionId("22222222-2222-4222-8222-222222222222"), "2026-01-02T00:00:00.000Z", [
        entry(pushId, 2, repsRule, [single(10), single(10), single(10)]),
      ]),
    ]

    // When: the level timeline is requested.
    const result = getLevelTimeline({ sessions, categoryId: pushId })

    // Then: only level changes are emitted in date order.
    expect(result).toEqual([
      { completedAt: "2026-01-01T00:00:00.000Z", level: 1 },
      { completedAt: "2026-01-02T00:00:00.000Z", level: 2 },
    ])
  })

  it("returns raw-unit chart series without cross-unit aggregation", () => {
    // Given: records contain reps, seconds, load, and per-side values.
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pushId, 1, repsRule, [single(12, 5), single(13, 5), single(14, 5)]),
        entry(pushId, 1, secondsRule, [single(30), single(31), single(32)]),
        entry(pushId, 1, sideRule, [side(5, 6), side(6, 7), side(7, 8)]),
      ]),
    ]

    // When: raw chart series are requested.
    const result = getRawUnitChartSeries({ sessions, categoryId: pushId })

    // Then: incompatible units are separate named series.
    expect(result).toEqual([
      {
        unit: "reps",
        points: [
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 0, value: 12 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 1, value: 13 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 2, value: 14 },
        ],
      },
      {
        unit: "kg",
        points: [
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 0, value: 5 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 1, value: 5 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 2, value: 5 },
        ],
      },
      {
        unit: "seconds",
        points: [
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 0, value: 30 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 1, value: 31 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 2, value: 32 },
        ],
      },
      {
        unit: "perSideReps",
        points: [
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 0, left: 5, right: 6 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 1, left: 6, right: 7 },
          { completedAt: "2026-01-01T00:00:00.000Z", setIndex: 2, left: 7, right: 8 },
        ],
      },
    ])
  })

  it("uses seconds as the same-level PR when only duration records exist", () => {
    // Given: same-level history contains only duration records.
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pushId, 1, secondsRule, [single(30), single(31), single(32)]),
      ]),
    ]

    // When: the same-level PR is computed.
    const result = getSameLevelPr({ sessions, categoryId: pushId, level: 1 })

    // Then: seconds remain seconds instead of being mixed with reps.
    expect(result).toEqual({
      kind: "found",
      bestSingleValue: { unit: "seconds", value: 32 },
      bestLoadKg: undefined,
      bestPerSideValue: undefined,
    })
  })

  it("ignores terminal entries in raw numeric history", () => {
    // Given: a terminal level has no raw numeric metric.
    const terminalRule: MetricRule = { kind: "terminal", label: "상급 목표", laterality: "none" }
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pushId, 8, terminalRule, [single(1)]),
      ]),
    ]

    // When: chart series are built.
    const result = getRawUnitChartSeries({ sessions, categoryId: pushId })

    // Then: the terminal entry produces no misleading numeric series.
    expect(result).toEqual([])
  })

  it("rejects malformed metric records at the exhaustive guard", () => {
    // Given: an impossible metric discriminant reaches history from malformed state.
    const sessions = [
      session(sessionId("11111111-1111-4111-8111-111111111111"), "2026-01-01T00:00:00.000Z", [
        entry(pushId, 1, JSON.parse('{"kind":"mystery"}'), [single(1)]),
      ]),
    ]

    // When / Then: the exhaustive guard rejects the malformed metric.
    expect(() => getSameLevelPr({ sessions, categoryId: pushId, level: 1 })).toThrow(
      "Unexpected domain variant",
    )
  })
})

import { describe, expect, it } from "vitest"
import { adjustRestTimer, getRestTimerSnapshot, skipRestTimer, startRestTimer } from "./rest-timer"

describe("absolute rest timer", () => {
  it("calculates remaining time from the absolute end timestamp", () => {
    // Given: a two-minute rest started at a deterministic clock value.
    const timer = startRestTimer({ nowMs: 1_000, durationSeconds: 120 })

    // When: the app reloads before and after the timer expires.
    const beforeExpiry = getRestTimerSnapshot({ timer, nowMs: 61_000 })
    const afterExpiry = getRestTimerSnapshot({ timer, nowMs: 122_000 })

    // Then: remaining time is derived from restEndsAt, not from elapsed sleeps.
    expect(timer.restEndsAt).toBe("1970-01-01T00:02:01.000Z")
    expect(beforeExpiry.remainingSeconds).toBe(60)
    expect(afterExpiry.remainingSeconds).toBe(0)
  })

  it("adjusts rest by thirty seconds and floors the remaining time at zero", () => {
    // Given: a rest timer with twenty seconds remaining.
    const timer = startRestTimer({ nowMs: 0, durationSeconds: 60 })

    // When: the user removes thirty seconds, then adds thirty seconds.
    const shortened = adjustRestTimer({ timer, nowMs: 40_000, deltaSeconds: -30 })
    const extended = adjustRestTimer({ timer: shortened, nowMs: 40_000, deltaSeconds: 30 })

    // Then: the timer cannot go below zero and extension remains absolute.
    expect(getRestTimerSnapshot({ timer: shortened, nowMs: 40_000 }).remainingSeconds).toBe(0)
    expect(getRestTimerSnapshot({ timer: extended, nowMs: 40_000 }).remainingSeconds).toBe(30)
  })

  it("skips rest immediately", () => {
    // Given: an active rest timer.
    const timer = startRestTimer({ nowMs: 0, durationSeconds: 180 })

    // When: the user skips rest.
    const skipped = skipRestTimer({ timer, nowMs: 10_000 })

    // Then: the timer has no remaining time.
    expect(getRestTimerSnapshot({ timer: skipped, nowMs: 10_000 }).remainingSeconds).toBe(0)
  })

  it("announces only threshold crossings for thirty, ten, and zero seconds", () => {
    // Given: an active timer and the previous rendered remaining second.
    const timer = startRestTimer({ nowMs: 0, durationSeconds: 45 })

    // When: time crosses supported announcement thresholds.
    const thirty = getRestTimerSnapshot({ timer, nowMs: 15_000, previousRemainingSeconds: 31 })
    const ten = getRestTimerSnapshot({ timer, nowMs: 35_000, previousRemainingSeconds: 11 })
    const zero = getRestTimerSnapshot({ timer, nowMs: 45_000, previousRemainingSeconds: 1 })
    const arbitrary = getRestTimerSnapshot({ timer, nowMs: 20_000, previousRemainingSeconds: 26 })

    // Then: no arbitrary second emits announcement noise.
    expect(thirty.announcements).toEqual(["30"])
    expect(ten.announcements).toEqual(["10"])
    expect(zero.announcements).toEqual(["0"])
    expect(arbitrary.announcements).toEqual([])
  })
})

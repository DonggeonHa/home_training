import { describe, expect, it } from "vitest"
import { getRestTimerSnapshot } from "../domain/rest-timer"
import { CategoryIdSchema, SessionIdSchema } from "../domain/schemas"
import { createDefaultStoredState } from "./defaults"
import { loadStoredState, saveStoredState } from "./persistence"
import type { ClockPort } from "./ports"
import type { StoredState } from "./schemas"
import { MemoryStoragePort } from "./test-ports"

class ManualClockPort implements ClockPort {
  constructor(private readonly epochMs: number) {}

  nowMs(): number {
    return this.epochMs
  }
}

describe("active session persistence", () => {
  it("loads an active session rest timer and calculates remaining time from an injected clock", () => {
    // Given: persisted active-session state with an absolute rest end timestamp.
    const storage = new MemoryStoragePort()
    const state: StoredState = {
      ...createDefaultStoredState(),
      activeSession: {
        id: SessionIdSchema.parse("44444444-4444-4444-8444-444444444444"),
        routineId: "C",
        startedAt: "2026-09-01T01:00:00.000Z",
        currentEntry: { categoryId: CategoryIdSchema.parse("pull"), level: 2 },
        completedSetIndexes: [0],
        restTimer: { restEndsAt: "2026-09-01T01:02:00.000Z" },
      },
    }
    const beforeExpiryClock = new ManualClockPort(Date.parse("2026-09-01T01:01:15.000Z"))
    const afterExpiryClock = new ManualClockPort(Date.parse("2026-09-01T01:02:01.000Z"))

    // When: the app saves, reloads, and snapshots rest from injected clocks.
    saveStoredState({ storage, state })
    const loaded = loadStoredState({ storage }).state
    const restTimer = loaded.activeSession?.restTimer
    const beforeExpiry =
      restTimer === undefined || restTimer === null
        ? null
        : getRestTimerSnapshot({ timer: restTimer, nowMs: beforeExpiryClock.nowMs() })
    const afterExpiry =
      restTimer === undefined || restTimer === null
        ? null
        : getRestTimerSnapshot({ timer: restTimer, nowMs: afterExpiryClock.nowMs() })

    // Then: reload recovery preserves the timer and uses clock injection for time math.
    expect(beforeExpiry?.remainingSeconds).toBe(45)
    expect(afterExpiry?.remainingSeconds).toBe(0)
  })
})

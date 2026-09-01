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

  it("roundtrips workout snapshot bytes without dropping completed set details", () => {
    // Given: persisted active-session state includes an in-progress workout snapshot.
    const storage = new MemoryStoragePort()
    const categoryId = CategoryIdSchema.parse("push")
    const state: StoredState = {
      ...createDefaultStoredState(),
      activeSession: {
        id: SessionIdSchema.parse("55555555-5555-4555-8555-555555555555"),
        routineId: "A",
        startedAt: "2026-09-01T01:00:00.000Z",
        currentEntry: { categoryId, level: 0 },
        completedSetIndexes: [0],
        restTimer: { restEndsAt: "2026-09-01T01:02:00.000Z" },
        workout: {
          currentCategoryIndex: 0,
          currentSetIndex: 1,
          phase: "rest",
          commonWarmupComplete: true,
          categoryWarmupCompleteByCategory: {
            push: true,
            pull: false,
            squat: false,
            hinge: false,
            verticalPush: false,
            core: false,
          },
          categoryPlans: [
            {
              categoryId,
              categoryTitle: "PUSH",
              prescribedSetCount: 3,
              restSeconds: 90,
              instructions: ["brace"],
              mistakes: ["sagging"],
              safety: ["stop for pain"],
              entry: {
                categoryId,
                level: 0,
                exerciseName: "Incline push-up",
                metricRule: {
                  kind: "reps",
                  min: 8,
                  max: 12,
                  sets: 3,
                  laterality: "none",
                  rir: { min: 1, max: 2 },
                },
                sets: [
                  {
                    kind: "single",
                    value: 10,
                    loadKg: 5,
                    rir: 2,
                    quality: { pain: false, form: "good", rom: "full" },
                  },
                ],
              },
              qualification: null,
              stoppedByPain: false,
              pullChecklistConfirmed: true,
            },
          ],
          lastAnnouncement: "30",
          setDraft: null,
          error: null,
          showAbandonDialog: false,
        },
      },
    }

    // When: the state is saved to JSON bytes and loaded through the parser.
    saveStoredState({ storage, state })
    const loaded = loadStoredState({ storage }).state

    // Then: nested set records and resume metadata survive unchanged.
    expect(loaded.activeSession?.workout?.categoryPlans[0]?.entry.sets[0]).toMatchObject({
      kind: "single",
      loadKg: 5,
      rir: 2,
      value: 10,
    })
    expect(loaded.activeSession?.workout?.lastAnnouncement).toBe("30")
    expect(loaded.activeSession?.restTimer?.restEndsAt).toBe("2026-09-01T01:02:00.000Z")
  })
})

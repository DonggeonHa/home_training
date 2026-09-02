import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../domain/schemas"
import { createDefaultStoredState } from "./defaults"
import { loadStoredState, type StoragePort, saveStoredState } from "./persistence"
import type { StoredState } from "./schemas"

class MemoryStoragePort implements StoragePort {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe("active session persistence", () => {
  it("persists an active session with rest end timestamp and completed set indexes", () => {
    // Given: a valid state with a workout in progress.
    const storage = new MemoryStoragePort()
    const state: StoredState = {
      ...createDefaultStoredState(),
      activeSession: {
        id: SessionIdSchema.parse("22222222-2222-4222-8222-222222222222"),
        routineId: "B",
        startedAt: "2026-09-01T01:00:00.000Z",
        currentEntry: { categoryId: CategoryIdSchema.parse("push"), level: 1 },
        completedSetIndexes: [0, 1],
        restTimer: { restEndsAt: "2026-09-01T01:03:00.000Z" },
      },
    }

    // When: the app saves and reloads the state.
    const saveResult = saveStoredState({ storage, state })
    const loadResult = loadStoredState({ storage })

    // Then: save success is claimed only after storage accepts the write.
    expect(saveResult).toEqual({ kind: "saved" })
    expect(loadResult.state.activeSession).toEqual(state.activeSession)
  })
})

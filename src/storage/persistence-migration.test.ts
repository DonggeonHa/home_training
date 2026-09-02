import { afterEach, describe, expect, it, vi } from "vitest"
import { createDefaultStoredState } from "./defaults"
import { APP_STORAGE_KEY, loadStoredState, type StoragePort } from "./persistence"

class MemoryStoragePort implements StoragePort {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe("persistence migrations", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("migrates the minimal legacy V0 levels and sessions shape", () => {
    // Given: a legacy payload with levels and completed sessions.
    const storage = new MemoryStoragePort()
    storage.values.set(
      APP_STORAGE_KEY,
      JSON.stringify({
        levels: { push: 3, pull: 1, squat: 2, hinge: 2, verticalPush: 0, core: 1 },
        sessions: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            routineId: "A",
            completedAt: "2026-09-01T00:00:00.000Z",
            entries: [],
          },
        ],
      }),
    )

    // When: the app hydrates storage.
    const result = loadStoredState({ storage })

    // Then: the legacy levels become active schema-versioned progress.
    expect(result.notice).toMatchObject({ kind: "migrated", fromVersion: 0 })
    expect(result.state.schemaVersion).toBe(1)
    expect(result.state.progress.push.level).toBe(3)
    expect(result.state.progress.push.status).toBe("active")
    expect(result.state.completedSessions).toHaveLength(1)
  })

  it("migrates legacy V0 levels when sessions are absent", () => {
    // Given: a legacy payload from before completed session history existed.
    const storage = new MemoryStoragePort()
    storage.values.set(
      APP_STORAGE_KEY,
      JSON.stringify({
        levels: { push: 0, pull: 0, squat: 0, hinge: 0, verticalPush: 0, core: 0 },
      }),
    )

    // When: the app hydrates storage.
    const result = loadStoredState({ storage })

    // Then: migration succeeds with an empty completed-session history.
    expect(result.notice).toMatchObject({ kind: "migrated", fromVersion: 0 })
    expect(result.state.completedSessions).toEqual([])
  })

  it("recovers when a legacy V0 payload contains invalid sessions", () => {
    // Given: legacy levels with session data that cannot become current completed history.
    const storage = new MemoryStoragePort()
    storage.values.set(
      APP_STORAGE_KEY,
      JSON.stringify({
        levels: { push: 0, pull: 0, squat: 0, hinge: 0, verticalPush: 0, core: 0 },
        sessions: [{ id: "not-a-session" }],
      }),
    )

    // When: the app hydrates storage.
    const result = loadStoredState({ storage })

    // Then: unsafe partial migration is rejected.
    expect(result.state).toEqual(createDefaultStoredState())
    expect(result.notice).toMatchObject({ kind: "recovered", reason: "schemaMismatch" })
  })
})

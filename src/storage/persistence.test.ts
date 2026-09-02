import { afterEach, describe, expect, it, vi } from "vitest"
import { createDefaultStoredState } from "./defaults"
import { APP_STORAGE_KEY, loadStoredState, type StoragePort, saveStoredState } from "./persistence"

class MemoryStoragePort implements StoragePort {
  readonly values = new Map<string, string>()
  writeError: DOMException | Error | null = null

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.writeError !== null) {
      throw this.writeError
    }
    this.values.set(key, value)
  }
}

class ThrowingStoragePort implements StoragePort {
  constructor(
    private readonly readError: Error | null,
    private readonly writeError: Error | null,
  ) {}

  getItem(_key: string): string | null {
    if (this.readError !== null) {
      throw this.readError
    }
    return null
  }

  setItem(_key: string, _value: string): void {
    if (this.writeError !== null) {
      throw this.writeError
    }
  }
}

class UnknownThrowingStoragePort implements StoragePort {
  getItem(_key: string): string | null {
    throw { kind: "unexpected" }
  }

  setItem(_key: string, _value: string): void {
    throw { kind: "unexpected" }
  }
}

describe("versioned persistence", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("loads a default state when storage is empty", () => {
    // Given: an empty storage adapter.
    const storage = new MemoryStoragePort()

    // When: the app hydrates from local persistence.
    const result = loadStoredState({ storage })

    // Then: every category starts at a safe unassessed level.
    expect(result.notice).toBeUndefined()
    expect(result.state).toEqual(createDefaultStoredState())
  })

  it("recovers from malformed and future-version storage while preserving the raw snapshot", () => {
    // Given: malformed data and a future schema payload.
    const malformed = new MemoryStoragePort()
    malformed.values.set(APP_STORAGE_KEY, "{not-json")
    const future = new MemoryStoragePort()
    future.values.set(APP_STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }))

    // When: the app hydrates both snapshots.
    const malformedResult = loadStoredState({ storage: malformed })
    const futureResult = loadStoredState({ storage: future })

    // Then: both recover to defaults with typed notices and byte-equivalent raw data.
    expect(malformedResult.state).toEqual(createDefaultStoredState())
    expect(malformedResult.notice).toMatchObject({ kind: "recovered", reason: "malformedJson" })
    expect(malformedResult.rawSnapshot).toBe("{not-json")
    expect(futureResult.state).toEqual(createDefaultStoredState())
    expect(futureResult.notice).toMatchObject({ kind: "recovered", reason: "futureVersion" })
  })

  it("recovers from current-version schema mismatch while preserving the raw snapshot", () => {
    // Given: valid JSON that is neither the current schema nor a legacy shape.
    const storage = new MemoryStoragePort()
    storage.values.set(APP_STORAGE_KEY, JSON.stringify({ schemaVersion: 1 }))

    // When: the app hydrates storage.
    const result = loadStoredState({ storage })

    // Then: it falls back safely and keeps the raw bytes for recovery messaging.
    expect(result.state).toEqual(createDefaultStoredState())
    expect(result.notice).toMatchObject({ kind: "recovered", reason: "schemaMismatch" })
    expect(result.rawSnapshot).toBe(JSON.stringify({ schemaVersion: 1 }))
  })

  it("recovers when storage cannot be read", () => {
    // Given: browser storage rejects reads before bytes are available.
    const securityStorage = new ThrowingStoragePort(
      new DOMException("denied", "SecurityError"),
      null,
    )
    const unavailableStorage = new ThrowingStoragePort(new Error("storage unavailable"), null)

    // When: the app hydrates local persistence.
    const securityResult = loadStoredState({ storage: securityStorage })
    const unavailableResult = loadStoredState({ storage: unavailableStorage })

    // Then: hydration falls back to defaults with a storage-unavailable notice.
    expect(securityResult.state).toEqual(createDefaultStoredState())
    expect(securityResult.notice).toEqual({ kind: "recovered", reason: "storageUnavailable" })
    expect(securityResult.rawSnapshot).toBeUndefined()
    expect(unavailableResult.state).toEqual(createDefaultStoredState())
    expect(unavailableResult.notice).toEqual({ kind: "recovered", reason: "storageUnavailable" })
    expect(unavailableResult.rawSnapshot).toBeUndefined()
  })

  it("returns typed failures for quota and security storage exceptions", () => {
    // Given: storage adapters that reject writes.
    const quota = new MemoryStoragePort()
    quota.writeError = new DOMException("full", "QuotaExceededError")
    const security = new MemoryStoragePort()
    security.writeError = new DOMException("denied", "SecurityError")

    // When: the app attempts to persist state.
    const quotaResult = saveStoredState({ storage: quota, state: createDefaultStoredState() })
    const securityResult = saveStoredState({ storage: security, state: createDefaultStoredState() })

    // Then: neither result reports a misleading success.
    expect(quotaResult).toEqual({ kind: "failed", reason: "quotaExceeded" })
    expect(securityResult).toEqual({ kind: "failed", reason: "securityBlocked" })
    expect(quota.values.has(APP_STORAGE_KEY)).toBe(false)
    expect(security.values.has(APP_STORAGE_KEY)).toBe(false)
  })

  it("returns typed failures for unclassified storage errors", () => {
    // Given: storage adapters that reject writes with other expected error types.
    const domStorage = new MemoryStoragePort()
    domStorage.writeError = new DOMException("unknown", "UnknownError")
    const errorStorage = new ThrowingStoragePort(null, new Error("storage unavailable"))

    // When: the app attempts to persist state.
    const domResult = saveStoredState({ storage: domStorage, state: createDefaultStoredState() })
    const errorResult = saveStoredState({
      storage: errorStorage,
      state: createDefaultStoredState(),
    })

    // Then: failures remain typed without claiming success.
    expect(domResult).toEqual({ kind: "failed", reason: "unknownStorageError" })
    expect(errorResult).toEqual({ kind: "failed", reason: "unknownStorageError" })
  })

  it("rethrows unexpected storage failures and recovers parser failures", () => {
    // Given: non-Error storage failures and an unexpected JSON parser failure.
    const throwingStorage = new UnknownThrowingStoragePort()
    const storage = new MemoryStoragePort()
    storage.values.set(APP_STORAGE_KEY, "{}")
    vi.spyOn(JSON, "parse").mockImplementation(() => {
      throw new TypeError("parser unavailable")
    })

    // When / Then: unknown failures are not swallowed as recovery notices.
    expect(() => loadStoredState({ storage: throwingStorage })).toThrow()
    expect(() =>
      saveStoredState({ storage: throwingStorage, state: createDefaultStoredState() }),
    ).toThrow()
    const result = loadStoredState({ storage })
    expect(result.state).toEqual(createDefaultStoredState())
    expect(result.notice).toEqual({ kind: "recovered", reason: "malformedJson" })
    expect(result.rawSnapshot).toBe("{}")
  })

  it("returns a typed validation failure when saving malformed state", () => {
    // Given: a malformed state payload crosses the persistence boundary.
    const storage = new MemoryStoragePort()
    const malformedState = JSON.parse('{"schemaVersion":1,"nextRoutine":"A"}')

    // When: the app attempts to save it.
    const result = saveStoredState({ storage, state: malformedState })

    // Then: schema validation is reported as a typed failure and no data is written.
    expect(result).toEqual({ kind: "failed", reason: "validationFailed" })
    expect(storage.values.has(APP_STORAGE_KEY)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { createRestorePreview, restoreStoredStateToStorage } from "./backup"
import { createDefaultStoredState } from "./defaults"
import { APP_STORAGE_KEY } from "./persistence"
import { FailingDownloadPort, MemoryDownloadPort, MemoryStoragePort } from "./test-ports"

describe("persistent backup restore", () => {
  it("keeps current storage bytes unchanged when the pre-restore backup download fails", () => {
    // Given: current state is already persisted and a replacement preview is valid.
    const current = {
      ...createDefaultStoredState(),
      safety: { cleared: true, clearedAt: "2026-09-01T00:00:00.000Z" },
    }
    const replacement = createDefaultStoredState()
    const preview = createRestorePreview({ rawJson: JSON.stringify(replacement), current })
    const storage = new MemoryStoragePort()
    const currentBytes = JSON.stringify(current)
    expect(storage.getItem(APP_STORAGE_KEY)).toBeNull()
    storage.setItem(APP_STORAGE_KEY, currentBytes)

    // When: confirmation is correct but the pre-restore download port fails.
    const result =
      preview.kind === "valid"
        ? restoreStoredStateToStorage({
            preview,
            confirmation: preview.confirmationToken,
            current,
            downloads: new FailingDownloadPort(),
            storage,
          })
        : { kind: "restored", state: replacement }

    // Then: replacement is blocked and storage remains byte-equivalent.
    expect(result).toEqual({
      kind: "failed",
      reason: "preRestoreBackupFailed",
      state: current,
    })
    expect(storage.getItem(APP_STORAGE_KEY)).toBe(currentBytes)
  })

  it("keeps current storage bytes unchanged when persistent restore cannot save replacement", () => {
    // Given: pre-restore backup succeeds, but storage rejects the replacement write.
    const current = {
      ...createDefaultStoredState(),
      safety: { cleared: true, clearedAt: "2026-09-01T00:00:00.000Z" },
    }
    const replacement = createDefaultStoredState()
    const preview = createRestorePreview({ rawJson: JSON.stringify(replacement), current })
    const storage = new MemoryStoragePort()
    const currentBytes = JSON.stringify(current)
    storage.setItem(APP_STORAGE_KEY, currentBytes)
    storage.writeError = new DOMException("full", "QuotaExceededError")

    // When: persistent restore reaches the storage replacement boundary.
    const result =
      preview.kind === "valid"
        ? restoreStoredStateToStorage({
            preview,
            confirmation: preview.confirmationToken,
            current,
            downloads: new MemoryDownloadPort(),
            storage,
          })
        : { kind: "restored", state: replacement }

    // Then: storage failure is typed and the original bytes remain.
    expect(result).toEqual({ kind: "failed", reason: "storageSaveFailed", state: current })
    expect(storage.getItem(APP_STORAGE_KEY)).toBe(currentBytes)
  })

  it("does not download or write when persistent restore lacks a valid preview or token", () => {
    // Given: invalid and unconfirmed restore attempts.
    const current = createDefaultStoredState()
    const replacement = {
      ...current,
      safety: { cleared: true, clearedAt: "2026-09-01T00:00:00.000Z" },
    }
    const invalidPreview = createRestorePreview({ rawJson: "{broken", current })
    const validPreview = createRestorePreview({ rawJson: JSON.stringify(replacement), current })
    const downloads = new MemoryDownloadPort()
    const storage = new MemoryStoragePort()
    const currentBytes = JSON.stringify(current)
    storage.setItem(APP_STORAGE_KEY, currentBytes)

    // When: persistent restore is rejected before replacement.
    const invalidResult = restoreStoredStateToStorage({
      preview: invalidPreview,
      confirmation: "REPLACE",
      current,
      downloads,
      storage,
    })
    const mismatchResult =
      validPreview.kind === "valid"
        ? restoreStoredStateToStorage({
            preview: validPreview,
            confirmation: "wrong",
            current,
            downloads,
            storage,
          })
        : invalidResult

    // Then: neither backup nor storage replacement runs.
    expect(invalidResult).toEqual({ kind: "rejected", reason: "invalidPreview", state: current })
    expect(mismatchResult).toEqual({
      kind: "rejected",
      reason: "confirmationMismatch",
      state: current,
    })
    expect(downloads.downloads).toEqual([])
    expect(storage.getItem(APP_STORAGE_KEY)).toBe(currentBytes)
  })
})

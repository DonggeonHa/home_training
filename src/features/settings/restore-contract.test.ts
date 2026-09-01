import { describe, expect, it } from "vitest"
import { createRestorePreview, exportStoredState } from "../../storage"
import type { DownloadPort } from "../../storage/ports"
import { FailingDownloadPort, MemoryDownloadPort } from "../../storage/test-ports"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { prepareRestore, restoreFailureMessage } from "./restore-contract"

const nonErrorFailure = { kind: "nonErrorFailure" } as const

class NonErrorDownloadPort implements DownloadPort {
  downloadJson(_fileName: string, _content: string): void {
    throw nonErrorFailure
  }
}

describe("settings restore contract", () => {
  it("prepares rejected, failed, and restored results without saving prematurely", () => {
    const current = createCompletedOnboardingState()
    const preview = createRestorePreview({
      current,
      rawJson: exportStoredState({ ...current, completedSessions: [] }),
    })

    expect(prepareRestore(preview, "", current, new MemoryDownloadPort())).toMatchObject({
      kind: "rejected",
      state: current,
    })
    expect(prepareRestore(preview, "REPLACE", current, new FailingDownloadPort())).toMatchObject({
      kind: "failed",
      state: current,
    })
    expect(prepareRestore(preview, "REPLACE", current, new MemoryDownloadPort())).toMatchObject({
      kind: "restored",
      state: { ...current, completedSessions: [] },
    })
  })

  it("rethrows non-error backup failures and maps typed save failures to user copy", () => {
    const current = createCompletedOnboardingState()
    const preview = createRestorePreview({ current, rawJson: exportStoredState(current) })

    expect(() => prepareRestore(preview, "REPLACE", current, new NonErrorDownloadPort())).toThrow()
    expect(restoreFailureMessage("storageSaveFailed")).toBe(
      "저장에 실패해 현재 상태를 유지했습니다.",
    )
    expect(restoreFailureMessage("unknownStorageError")).toBe(
      "알 수 없는 저장 오류로 현재 상태를 유지했습니다.",
    )
  })
})

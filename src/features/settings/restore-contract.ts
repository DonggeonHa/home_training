import type { RestorePreview } from "../../storage/backup"
import { restoreStoredState } from "../../storage/backup"
import type { DownloadPort } from "../../storage/ports"
import type { StoredState } from "../../storage/schemas"

export type SettingsRestoreCommitResult =
  | {
      readonly kind: "saved"
    }
  | {
      readonly kind: "failed"
      readonly reason: SettingsRestoreFailureReason
    }

export type SettingsRestoreFailureReason = "storageSaveFailed" | "unknownStorageError"

export type PreparedRestoreResult =
  | ReturnType<typeof restoreStoredState>
  | {
      readonly kind: "failed"
      readonly state: StoredState
    }

export function prepareRestore(
  preview: RestorePreview,
  confirmation: string,
  currentState: StoredState,
  downloads: DownloadPort,
): PreparedRestoreResult {
  try {
    return restoreStoredState({
      preview,
      confirmation,
      current: currentState,
      downloads,
    })
  } catch (error) {
    if (error instanceof DOMException || error instanceof Error) {
      return { kind: "failed", state: currentState }
    }
    throw error
  }
}

export function restoreFailureMessage(reason: SettingsRestoreFailureReason): string {
  switch (reason) {
    case "storageSaveFailed":
      return "저장에 실패해 현재 상태를 유지했습니다."
    case "unknownStorageError":
      return "알 수 없는 저장 오류로 현재 상태를 유지했습니다."
  }
}

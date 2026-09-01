import { type StoragePort, saveStoredState } from "./persistence"
import type { DownloadPort } from "./ports"
import { isFutureVersion, type StoredState, StoredStateSchema } from "./schemas"

export type { DownloadPort } from "./ports"

const MAX_IMPORT_BYTES = 2 * 1024 * 1024
const CONFIRMATION_TOKEN = "REPLACE"

export type RestoreDateRange = {
  readonly from: string | null
  readonly to: string | null
}

export type RestorePreview =
  | {
      readonly kind: "valid"
      readonly state: StoredState
      readonly sessionCount: number
      readonly levels: Record<keyof StoredState["progress"], number>
      readonly dateRange: RestoreDateRange
      readonly confirmationToken: typeof CONFIRMATION_TOKEN
    }
  | {
      readonly kind: "invalid"
      readonly reason: "tooLarge" | "malformedJson" | "futureVersion" | "schemaMismatch"
      readonly currentState: StoredState
    }

export type RestoreResult =
  | {
      readonly kind: "restored"
      readonly state: StoredState
    }
  | {
      readonly kind: "rejected"
      readonly reason: "invalidPreview" | "confirmationMismatch"
      readonly state: StoredState
    }

export type RestorePersistenceResult =
  | RestoreResult
  | {
      readonly kind: "failed"
      readonly reason: "preRestoreBackupFailed" | "storageSaveFailed"
      readonly state: StoredState
    }

export type RestorePreviewInput = {
  readonly rawJson: string
  readonly current: StoredState
}

export type RestoreInput = {
  readonly preview: RestorePreview
  readonly confirmation: string
  readonly current: StoredState
  readonly downloads: DownloadPort
}

export type RestorePersistenceInput = RestoreInput & {
  readonly storage: StoragePort
}

export function exportStoredState(state: StoredState): string {
  return JSON.stringify(StoredStateSchema.parse(state), null, 2)
}

export function createRestorePreview(input: RestorePreviewInput): RestorePreview {
  if (getUtf8ByteLength(input.rawJson) > MAX_IMPORT_BYTES) {
    return invalidPreview("tooLarge", input.current)
  }

  const parsed = parseRestoreJson(input.rawJson)
  if (!parsed.success) {
    return invalidPreview("malformedJson", input.current)
  }

  if (isFutureVersion(parsed.value)) {
    return invalidPreview("futureVersion", input.current)
  }

  const stateResult = StoredStateSchema.safeParse(parsed.value)
  if (!stateResult.success) {
    return invalidPreview("schemaMismatch", input.current)
  }

  return {
    kind: "valid",
    state: stateResult.data,
    sessionCount: stateResult.data.completedSessions.length,
    levels: getLevels(stateResult.data),
    dateRange: getDateRange(stateResult.data),
    confirmationToken: CONFIRMATION_TOKEN,
  }
}

export function restoreStoredState(input: RestoreInput): RestoreResult {
  if (input.preview.kind !== "valid") {
    return { kind: "rejected", reason: "invalidPreview", state: input.current }
  }
  if (input.confirmation !== input.preview.confirmationToken) {
    return { kind: "rejected", reason: "confirmationMismatch", state: input.current }
  }

  input.downloads.downloadJson(
    "home-training-level-up-pre-restore.json",
    exportStoredState(input.current),
  )
  return { kind: "restored", state: input.preview.state }
}

export function restoreStoredStateToStorage(
  input: RestorePersistenceInput,
): RestorePersistenceResult {
  if (input.preview.kind !== "valid") {
    return { kind: "rejected", reason: "invalidPreview", state: input.current }
  }
  if (input.confirmation !== input.preview.confirmationToken) {
    return { kind: "rejected", reason: "confirmationMismatch", state: input.current }
  }

  try {
    input.downloads.downloadJson(
      "home-training-level-up-pre-restore.json",
      exportStoredState(input.current),
    )
  } catch (error) {
    if (error instanceof DOMException || error instanceof Error) {
      return { kind: "failed", reason: "preRestoreBackupFailed", state: input.current }
    }
    throw error
  }

  const saveResult = saveStoredState({ storage: input.storage, state: input.preview.state })
  return saveResult.kind === "saved"
    ? { kind: "restored", state: input.preview.state }
    : { kind: "failed", reason: "storageSaveFailed", state: input.current }
}

type JsonResult =
  | {
      readonly success: true
      readonly value: unknown
    }
  | {
      readonly success: false
    }

function parseRestoreJson(rawJson: string): JsonResult {
  try {
    return { success: true, value: JSON.parse(rawJson) }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false }
    }
    throw error
  }
}

function getLevels(state: StoredState): Record<keyof StoredState["progress"], number> {
  return {
    push: state.progress.push.level,
    pull: state.progress.pull.level,
    squat: state.progress.squat.level,
    hinge: state.progress.hinge.level,
    verticalPush: state.progress.verticalPush.level,
    core: state.progress.core.level,
  }
}

function getDateRange(state: StoredState): RestoreDateRange {
  const dates = state.completedSessions.map((session) => session.completedAt).sort()
  return {
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  }
}

function invalidPreview(
  reason: "tooLarge" | "malformedJson" | "futureVersion" | "schemaMismatch",
  currentState: StoredState,
): RestorePreview {
  return { kind: "invalid", reason, currentState }
}

function getUtf8ByteLength(value: string): number {
  let byteLength = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined) {
      continue
    }
    if (codePoint <= 0x7f) {
      byteLength += 1
    } else if (codePoint <= 0x7ff) {
      byteLength += 2
    } else if (codePoint <= 0xffff) {
      byteLength += 3
    } else {
      byteLength += 4
    }
  }
  return byteLength
}

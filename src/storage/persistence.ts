import { createDefaultStoredState } from "./defaults"
import { migrateLegacyV0 } from "./migration"
import type { StoragePort } from "./ports"
import {
  createMigratedNotice,
  createRecoveredNotice,
  isFutureVersion,
  type StorageLoadNotice,
  type StorageSaveFailureReason,
  type StorageSaveResult,
  type StoredState,
  StoredStateSchema,
} from "./schemas"

export type { StoragePort } from "./ports"

export const APP_STORAGE_KEY = "home-training-level-up:v1"

export type LoadStoredStateInput = {
  readonly storage: StoragePort
}

export type SaveStoredStateInput = {
  readonly storage: StoragePort
  readonly state: StoredState
}

export type LoadStoredStateResult = {
  readonly state: StoredState
  readonly notice?: StorageLoadNotice | undefined
  readonly rawSnapshot?: string | undefined
}

export function loadStoredState(input: LoadStoredStateInput): LoadStoredStateResult {
  const rawSnapshot = input.storage.getItem(APP_STORAGE_KEY)
  if (rawSnapshot === null) {
    return { state: createDefaultStoredState() }
  }

  const parsed = parseJson(rawSnapshot)
  if (!parsed.success) {
    return recover("malformedJson", rawSnapshot)
  }

  if (isFutureVersion(parsed.value)) {
    return recover("futureVersion", rawSnapshot)
  }

  const storedResult = StoredStateSchema.safeParse(parsed.value)
  if (storedResult.success) {
    return { state: storedResult.data }
  }

  const migrated = migrateLegacyV0(parsed.value)
  if (migrated !== null) {
    return { state: migrated, notice: createMigratedNotice(), rawSnapshot }
  }

  return recover("schemaMismatch", rawSnapshot)
}

export function saveStoredState(input: SaveStoredStateInput): StorageSaveResult {
  const parsedState = StoredStateSchema.parse(input.state)
  try {
    input.storage.setItem(APP_STORAGE_KEY, JSON.stringify(parsedState))
    return { kind: "saved" }
  } catch (error) {
    if (error instanceof DOMException) {
      return { kind: "failed", reason: classifyDomException(error) }
    }
    if (error instanceof Error) {
      return { kind: "failed", reason: "unknownStorageError" }
    }
    throw error
  }
}

type JsonParseResult =
  | {
      readonly success: true
      readonly value: unknown
    }
  | {
      readonly success: false
    }

function parseJson(rawSnapshot: string): JsonParseResult {
  try {
    return { success: true, value: JSON.parse(rawSnapshot) }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false }
    }
    throw error
  }
}

function recover(
  reason: "malformedJson" | "futureVersion" | "schemaMismatch",
  rawSnapshot: string,
) {
  return {
    state: createDefaultStoredState(),
    notice: createRecoveredNotice(reason),
    rawSnapshot,
  }
}

function classifyDomException(error: DOMException): StorageSaveFailureReason {
  switch (error.name) {
    case "QuotaExceededError":
    case "NS_ERROR_DOM_QUOTA_REACHED":
      return "quotaExceeded"
    case "SecurityError":
      return "securityBlocked"
    default:
      return "unknownStorageError"
  }
}

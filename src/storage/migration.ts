import { createDefaultStoredState } from "./defaults"
import { LegacyV0StateSchema, type StoredState, StoredStateSchema } from "./schemas"

export function migrateLegacyV0(value: unknown): StoredState | null {
  const legacyResult = LegacyV0StateSchema.safeParse(value)
  if (!legacyResult.success) {
    return null
  }

  const defaultState = createDefaultStoredState()
  const candidate = {
    ...defaultState,
    progress: {
      push: {
        ...defaultState.progress.push,
        level: legacyResult.data.levels.push,
        status: "active",
      },
      pull: {
        ...defaultState.progress.pull,
        level: legacyResult.data.levels.pull,
        status: "active",
      },
      squat: {
        ...defaultState.progress.squat,
        level: legacyResult.data.levels.squat,
        status: "active",
      },
      hinge: {
        ...defaultState.progress.hinge,
        level: legacyResult.data.levels.hinge,
        status: "active",
      },
      verticalPush: {
        ...defaultState.progress.verticalPush,
        level: legacyResult.data.levels.verticalPush,
        status: "active",
      },
      core: {
        ...defaultState.progress.core,
        level: legacyResult.data.levels.core,
        status: "active",
      },
    },
    completedSessions: legacyResult.data.sessions ?? [],
  }
  const result = StoredStateSchema.safeParse(candidate)
  return result.success ? result.data : null
}

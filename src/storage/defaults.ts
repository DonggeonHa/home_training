import { type CategoryProgressById, SCHEMA_VERSION } from "../domain/contracts"
import { CategoryIdSchema } from "../domain/schemas"
import type { StoredState } from "./schemas"

export function createDefaultStoredState(): StoredState {
  return {
    schemaVersion: SCHEMA_VERSION,
    safety: { cleared: false, clearedAt: null },
    nextRoutine: "A",
    progress: createDefaultProgress(),
    completedSessions: [],
    activeSession: null,
  }
}

export function createDefaultProgress(): CategoryProgressById {
  return {
    push: {
      categoryId: CategoryIdSchema.parse("push"),
      level: 0,
      status: "unassessed",
    },
    pull: {
      categoryId: CategoryIdSchema.parse("pull"),
      level: 0,
      status: "unassessed",
    },
    squat: {
      categoryId: CategoryIdSchema.parse("squat"),
      level: 0,
      status: "unassessed",
    },
    hinge: {
      categoryId: CategoryIdSchema.parse("hinge"),
      level: 0,
      status: "unassessed",
    },
    verticalPush: {
      categoryId: CategoryIdSchema.parse("verticalPush"),
      level: 0,
      status: "unassessed",
    },
    core: {
      categoryId: CategoryIdSchema.parse("core"),
      level: 0,
      status: "unassessed",
    },
  }
}

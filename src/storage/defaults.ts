import { type CategoryProgressById, SCHEMA_VERSION } from "../domain/contracts"
import { CategoryIdSchema } from "../domain/schemas"
import type { AssessmentState, StoredState } from "./schemas"

export function createDefaultStoredState(): StoredState {
  return {
    schemaVersion: SCHEMA_VERSION,
    safety: { cleared: false, clearedAt: null },
    nextRoutine: "A",
    progress: createDefaultProgress(),
    completedSessions: [],
    activeSession: null,
    assessment: createDefaultAssessmentState(),
  }
}

export function createDefaultAssessmentState(): AssessmentState {
  return {
    status: "notStarted",
    currentCategoryId: null,
    nextLevelByCategory: {
      push: 0,
      pull: 0,
      squat: 0,
      hinge: 0,
      verticalPush: 0,
      core: 0,
    },
    lastSafeLevelByCategory: {
      push: 0,
      pull: 0,
      squat: 0,
      hinge: 0,
      verticalPush: 0,
      core: 0,
    },
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

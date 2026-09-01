import { currentCategoryKey } from "../../app/store/selectors"
import { assertNever } from "../../domain/assert-never"
import type { CatalogCategory, CatalogLevel } from "../../domain/catalog"
import { EXERCISE_CATALOG } from "../../domain/catalog"
import { COMMON_WARMUP, GLOBAL_SAFETY_STOP_SIGNALS } from "../../domain/content/common"
import type {
  CategoryId,
  CategoryProgress,
  MetricRule,
  RoutineId,
  SessionEntry,
  SessionId,
} from "../../domain/contracts"
import { entryMeetsMinimum } from "../../domain/progression/progression"
import { getPrescribedSetCount, ROUTINES } from "../../domain/routines"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import type { StoredState } from "../../storage/schemas"
import {
  defaultCategoryWarmupState,
  restoreWorkoutSession,
  toWorkoutSnapshot,
} from "./session-snapshot"
import type { WorkoutCategoryPlan, WorkoutSession, WorkoutState } from "./types"

export { finishWorkout } from "./completion"

export const EMERGENCY_STOP_GUIDANCE =
  "흉통, 심한 어지럼증, 저림, 감각 이상이 있으면 운동을 멈추고 긴급 상황이면 119에 연락하세요."

export type StartWorkoutInput = {
  readonly stored: StoredState
  readonly now: Date
  readonly sessionId?: SessionId | undefined
}

export function startWorkoutSession(input: StartWorkoutInput): WorkoutSession {
  if (input.stored.activeSession !== null) {
    const restored = restoreWorkoutSession(input.stored.activeSession)
    if (restored !== null) {
      return restored
    }
  }
  const routine = ROUTINES[input.stored.activeSession?.routineId ?? input.stored.nextRoutine]
  const sessionId = input.stored.activeSession?.id ?? createSessionId(input.sessionId)
  const currentIndex = getCurrentCategoryIndex({
    routineId: routine.id,
    categoryId: input.stored.activeSession?.currentEntry.categoryId ?? routine.categoryIds[0],
  })

  return {
    id: sessionId,
    routineId: routine.id,
    startedAt: input.stored.activeSession?.startedAt ?? input.now.toISOString(),
    currentCategoryIndex: currentIndex,
    commonWarmupComplete: input.stored.activeSession !== null,
    categoryWarmupCompleteByCategory: defaultCategoryWarmupState(),
    categoryPlans: routine.categoryIds.map((categoryId) =>
      createCategoryPlan({
        categoryId,
        completedSessionCount: input.stored.completedSessions.length,
        progress: input.stored.progress[currentCategoryKey(categoryId)],
      }),
    ),
    restEndsAt: input.stored.activeSession?.restTimer?.restEndsAt ?? null,
    lastAnnouncement: null,
    completed: false,
  }
}

export function currentCategoryPlan(session: WorkoutSession): WorkoutCategoryPlan {
  const plan = session.categoryPlans[session.currentCategoryIndex]
  if (plan === undefined) {
    throw new Error("workout session has no current category")
  }
  return plan
}

export function commonWarmupItems() {
  return COMMON_WARMUP
}

export function globalStopSignals() {
  return GLOBAL_SAFETY_STOP_SIGNALS
}

export function acceptsRir(rule: MetricRule): boolean {
  switch (rule.kind) {
    case "reps":
    case "tempoReps":
      return rule.rir !== undefined
    case "duration":
    case "terminal":
      return false
    /* c8 ignore next 2 */
    default:
      return assertNever(rule)
  }
}

export function toActiveSessionPatch(state: WorkoutState) {
  if (state.session === null) {
    return null
  }
  const session = state.session
  const plan = currentCategoryPlan(session)
  return {
    id: session.id,
    routineId: session.routineId,
    startedAt: session.startedAt,
    currentEntry: {
      categoryId: plan.categoryId,
      level: plan.entry.level,
    },
    completedSetIndexes: plan.entry.sets.map((_, index) => index),
    restTimer: session.restEndsAt === null ? null : { restEndsAt: session.restEndsAt },
    workout: toWorkoutSnapshot(state),
  }
}

export function readCatalogCategory(id: CategoryId): CatalogCategory {
  const category = EXERCISE_CATALOG.find((candidate) => candidate.id === id)
  if (category === undefined) {
    throw new Error(`unknown workout category: ${id}`)
  }
  return category
}

export function readLevel(category: CatalogCategory, level: number): CatalogLevel {
  const catalogLevel = category.levels.find((candidate) => candidate.level === level)
  if (catalogLevel === undefined) {
    throw new Error(`unknown workout level: ${category.id} ${level}`)
  }
  return catalogLevel
}

function createSessionId(sessionId: SessionId | undefined): SessionId {
  return sessionId ?? SessionIdSchema.parse(crypto.randomUUID())
}

function getCurrentCategoryIndex(input: {
  readonly routineId: RoutineId
  readonly categoryId: CategoryId | undefined
}): number {
  /* c8 ignore next 3 */
  if (input.categoryId === undefined) {
    return 0
  }
  const index = ROUTINES[input.routineId].categoryIds.indexOf(input.categoryId)
  return Math.max(0, index)
}

function createCategoryPlan(input: {
  readonly categoryId: CategoryId
  readonly completedSessionCount: number
  readonly progress: CategoryProgress
}): WorkoutCategoryPlan {
  const category = readCatalogCategory(input.categoryId)
  const plannedLevel =
    input.progress.status === "testUnlocked" ? input.progress.level + 1 : input.progress.level
  const level = readLevel(category, plannedLevel)
  return {
    categoryId: category.id,
    categoryTitle: category.title,
    prescribedSetCount: getPrescribedSetCount(input.completedSessionCount),
    restSeconds: level.restSeconds,
    instructions: level.instructions,
    mistakes: level.mistakes,
    safety: level.safety,
    entry: {
      categoryId: category.id,
      level: level.level,
      exerciseName: level.name,
      metricRule: level.metricRule,
      sets: [],
    },
    qualification: null,
    stoppedByPain: false,
    pullChecklistConfirmed: category.doorframeBarChecklist === undefined,
    testFallbackLevel: input.progress.status === "testUnlocked" ? input.progress.level : undefined,
  }
}

export function setMeetsMinimum(entry: SessionEntry): boolean {
  return entryMeetsMinimum(entry)
}

export function categoryId(value: string): CategoryId {
  return CategoryIdSchema.parse(value)
}

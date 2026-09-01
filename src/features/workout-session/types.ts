import type {
  CategoryId,
  CompletedSession,
  RoutineId,
  SessionEntry,
  SessionId,
  SetQuality,
} from "../../domain/contracts"
import type { SessionQualificationResult } from "../../domain/progression/progression"
import type { ActiveSession, StoredState } from "../../storage/schemas"

export type WorkoutCategoryWarmupState = Readonly<{
  push: boolean
  pull: boolean
  squat: boolean
  hinge: boolean
  verticalPush: boolean
  core: boolean
}>

export type WorkoutSetDraft =
  | {
      readonly kind: "single"
      readonly valueText: string
      readonly rirText: string
      readonly loadText: string
      readonly quality: SetQuality
    }
  | {
      readonly kind: "perSide"
      readonly leftText: string
      readonly rightText: string
      readonly rirText: string
      readonly loadText: string
      readonly quality: SetQuality
    }

export type WorkoutCategoryPlan = {
  readonly categoryId: CategoryId
  readonly categoryTitle: string
  readonly prescribedSetCount: number
  readonly restSeconds: number
  readonly instructions: readonly string[]
  readonly mistakes: readonly string[]
  readonly safety: readonly string[]
  readonly entry: SessionEntry
  readonly testAttemptEntry?: SessionEntry | undefined
  readonly qualification: SessionQualificationResult | null
  readonly stoppedByPain: boolean
  readonly pullChecklistConfirmed: boolean
  readonly testFallbackLevel?: number | undefined
}

export type WorkoutSession = {
  readonly id: SessionId
  readonly routineId: RoutineId
  readonly startedAt: string
  readonly currentCategoryIndex: number
  readonly commonWarmupComplete: boolean
  readonly categoryWarmupCompleteByCategory: WorkoutCategoryWarmupState
  readonly categoryPlans: readonly WorkoutCategoryPlan[]
  readonly restEndsAt: string | null
  readonly lastAnnouncement: "30" | "10" | "0" | null
  readonly completed: boolean
}

export type WorkoutState = {
  readonly session: WorkoutSession | null
  readonly setDraft: WorkoutSetDraft | null
  readonly error: string | null
  readonly nowMs: number
  readonly lastAnnouncement: "30" | "10" | "0" | null
  readonly showAbandonDialog: boolean
}

export type WorkoutStoragePatch = {
  readonly activeSession: ActiveSession | null
  readonly completedSession?: CompletedSession | undefined
  readonly nextRoutine?: RoutineId | undefined
  readonly progress?: StoredState["progress"] | undefined
}

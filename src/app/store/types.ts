import type {
  CategoryId,
  CategoryProgressById,
  CompletedSession,
  RoutineId,
  SetQuality,
} from "../../domain/contracts"
import type {
  StorageLoadNotice,
  StorageSaveFailureReason,
  StoredState,
} from "../../storage/schemas"

export type SafetyAnswers = {
  readonly chestPain: boolean
  readonly faintingOrSevereDizziness: boolean
  readonly unusualShortnessOfBreath: boolean
  readonly cardiovascularMetabolicRenalDisease: boolean
  readonly recentInjury: boolean
}

export type SafetyBlockReason =
  | "chestPain"
  | "faintingOrSevereDizziness"
  | "unusualShortnessOfBreath"
  | "cardiovascularMetabolicRenalDisease"
  | "recentInjury"

export type SafetyBlock = {
  readonly kind: "blocked"
  readonly reasons: readonly SafetyBlockReason[]
  readonly urgent: boolean
}

export type SafetyGate =
  | { readonly kind: "cleared" }
  | { readonly kind: "needsReview" }
  | SafetyBlock

export type AppSaveNotice = {
  readonly kind: "saveFailed"
  readonly reason: StorageSaveFailureReason
}

export type AppStoreState = {
  readonly stored: StoredState
  readonly loadNotice?: StorageLoadNotice | undefined
  readonly saveNotice?: AppSaveNotice | undefined
  readonly safetyBlock?: SafetyBlock | undefined
}

export type WorkoutCompletionPatch = {
  readonly activeSession: null
  readonly completedSession?: CompletedSession | undefined
  readonly nextRoutine?: RoutineId | undefined
  readonly progress?: CategoryProgressById | undefined
}

export type AssessmentSetInput =
  | {
      readonly kind: "single"
      readonly value: number
      readonly pain: boolean
      readonly form: SetQuality["form"]
      readonly rom: SetQuality["rom"]
    }
  | {
      readonly kind: "perSide"
      readonly left: number
      readonly right: number
      readonly pain: boolean
      readonly form: SetQuality["form"]
      readonly rom: SetQuality["rom"]
    }

export type AssessmentStep =
  | {
      readonly kind: "active"
      readonly categoryId: CategoryId
      readonly categoryTitle: string
      readonly exerciseName: string
      readonly targetLabel: string
      readonly level: number
      readonly metricKind: AssessmentSetInput["kind"]
      readonly eligibleLevelCount: number
    }
  | { readonly kind: "ready" }
  | { readonly kind: "blocked" }
  | { readonly kind: "complete" }

export type AppStoreAction =
  | {
      readonly type: "safetyAnswersSubmitted"
      readonly answers: SafetyAnswers
      readonly now: string
    }
  | { readonly type: "safetyReviewReset" }
  | { readonly type: "assessmentStarted" }
  | {
      readonly type: "assessmentSetSubmitted"
      readonly categoryId: CategoryId
      readonly level: number
      readonly input: AssessmentSetInput
    }
  | {
      readonly type: "saveFailed"
      readonly reason: StorageSaveFailureReason
    }
  | {
      readonly type: "activeSessionChanged"
      readonly activeSession: StoredState["activeSession"]
    }
  | {
      readonly type: "workoutCompletionApplied"
      readonly patch: WorkoutCompletionPatch
    }
  | { readonly type: "saveSucceeded" }

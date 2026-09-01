declare const categoryIdBrand: unique symbol
declare const sessionIdBrand: unique symbol

export const SCHEMA_VERSION = 1

export const CATEGORY_IDS = ["push", "pull", "squat", "hinge", "verticalPush", "core"] as const

export type CategoryId = string & {
  readonly [categoryIdBrand]: "CategoryId"
}

export type SessionId = string & {
  readonly [sessionIdBrand]: "SessionId"
}

export type Laterality = "none" | "perSide"

export type RoutineId = "A" | "B" | "C"

export type ProgressStatus = "unassessed" | "provisional" | "active" | "testUnlocked"

export type RirGate = {
  readonly min: number
  readonly max: number
}

export type RepsMetricRule = {
  readonly kind: "reps"
  readonly min: number
  readonly max: number
  readonly sets: 3
  readonly laterality: Laterality
  readonly rir?: RirGate | undefined
}

export type DurationMetricRule = {
  readonly kind: "duration"
  readonly minSeconds: number
  readonly maxSeconds: number
  readonly sets: 3
  readonly laterality: Laterality
}

export type TempoRepsMetricRule = {
  readonly kind: "tempoReps"
  readonly reps: number
  readonly tempoSeconds: number
  readonly sets: 3
  readonly laterality: Laterality
}

export type TerminalMetricRule = {
  readonly kind: "terminal"
  readonly label: string
  readonly laterality: Laterality
}

export type MetricRule =
  | RepsMetricRule
  | DurationMetricRule
  | TempoRepsMetricRule
  | TerminalMetricRule

export type SetQuality = {
  readonly pain: boolean
  readonly form: "good" | "limited" | "failed"
  readonly rom: "full" | "partial" | "failed"
}

export type SingleSetRecord = {
  readonly kind: "single"
  readonly value: number
  readonly rir?: number | undefined
  readonly loadKg?: number | undefined
  readonly quality: SetQuality
}

export type PerSideSetRecord = {
  readonly kind: "perSide"
  readonly left: number
  readonly right: number
  readonly rir?: number | undefined
  readonly loadKg?: number | undefined
  readonly quality: SetQuality
}

export type SetRecord = SingleSetRecord | PerSideSetRecord

export type ExerciseLevel = {
  readonly level: number
  readonly name: string
  readonly metricRule: MetricRule
  readonly restSeconds: number
  readonly instructions: readonly string[]
  readonly mistakes: readonly string[]
  readonly safety: readonly string[]
}

export type ExerciseCategory = {
  readonly id: CategoryId
  readonly title: string
  readonly muscles: readonly string[]
  readonly warmup: readonly string[]
  readonly levels: readonly ExerciseLevel[]
}

export type CategoryProgress = {
  readonly categoryId: CategoryId
  readonly level: number
  readonly status: ProgressStatus
  readonly qualifiedSessionIds?: readonly SessionId[] | undefined
}

export type CategoryProgressById = {
  readonly push: CategoryProgress
  readonly pull: CategoryProgress
  readonly squat: CategoryProgress
  readonly hinge: CategoryProgress
  readonly verticalPush: CategoryProgress
  readonly core: CategoryProgress
}

export type SessionEntry = {
  readonly categoryId: CategoryId
  readonly level: number
  readonly exerciseName: string
  readonly metricRule: MetricRule
  readonly sets: readonly SetRecord[]
}

export type CompletedSession = {
  readonly id: SessionId
  readonly routineId: RoutineId
  readonly completedAt: string
  readonly entries: readonly SessionEntry[]
}

export type SafetyClearance = {
  readonly cleared: boolean
  readonly clearedAt: string | null
}

export type AppState = {
  readonly schemaVersion: typeof SCHEMA_VERSION
  readonly safety: SafetyClearance
  readonly nextRoutine: RoutineId
  readonly progress: CategoryProgressById
  readonly completedSessions: readonly CompletedSession[]
}

import { z } from "zod"
import { SCHEMA_VERSION } from "../domain/contracts"
import {
  CategoryIdSchema,
  CategoryProgressByIdSchema,
  SafetyClearanceSchema,
  SessionEntrySchema,
  SessionIdSchema,
} from "../domain/schemas"

const CompletedSetIndexesSchema = z.array(z.number().int().nonnegative()).readonly()

const CategoryWarmupStateSchema = z
  .object({
    push: z.boolean(),
    pull: z.boolean(),
    squat: z.boolean(),
    hinge: z.boolean(),
    verticalPush: z.boolean(),
    core: z.boolean(),
  })
  .strict()

const ActiveWorkoutCategoryPlanSchema = z
  .object({
    categoryId: CategoryIdSchema,
    categoryTitle: z.string().min(1),
    prescribedSetCount: z.number().int().positive(),
    restSeconds: z.number().int().nonnegative(),
    instructions: z.array(z.string().min(1)).readonly(),
    mistakes: z.array(z.string().min(1)).readonly(),
    safety: z.array(z.string().min(1)).readonly(),
    entry: SessionEntrySchema,
    testAttemptEntry: SessionEntrySchema.optional(),
    qualification: z.null(),
    stoppedByPain: z.boolean(),
    pullChecklistConfirmed: z.boolean(),
    testFallbackLevel: z.number().int().nonnegative().optional(),
  })
  .strict()

const ActiveWorkoutSetDraftSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("single"),
      valueText: z.string(),
      rirText: z.string(),
      loadText: z.string(),
      quality: z
        .object({
          pain: z.boolean(),
          form: z.union([z.literal("good"), z.literal("limited"), z.literal("failed")]),
          rom: z.union([z.literal("full"), z.literal("partial"), z.literal("failed")]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("perSide"),
      leftText: z.string(),
      rightText: z.string(),
      rirText: z.string(),
      loadText: z.string(),
      quality: z
        .object({
          pain: z.boolean(),
          form: z.union([z.literal("good"), z.literal("limited"), z.literal("failed")]),
          rom: z.union([z.literal("full"), z.literal("partial"), z.literal("failed")]),
        })
        .strict(),
    })
    .strict(),
])

const ActiveWorkoutSnapshotSchema = z
  .object({
    currentCategoryIndex: z.number().int().nonnegative(),
    currentSetIndex: z.number().int().nonnegative(),
    phase: z.union([
      z.literal("guidance"),
      z.literal("setEntry"),
      z.literal("rest"),
      z.literal("complete"),
    ]),
    commonWarmupComplete: z.boolean(),
    categoryWarmupCompleteByCategory: CategoryWarmupStateSchema,
    categoryPlans: z.array(ActiveWorkoutCategoryPlanSchema).readonly(),
    setDraft: ActiveWorkoutSetDraftSchema.nullable(),
    error: z.string().nullable(),
    showAbandonDialog: z.boolean(),
    lastAnnouncement: z.union([z.literal("30"), z.literal("10"), z.literal("0")]).nullable(),
  })
  .strict()

export const ActiveSessionSchema = z
  .object({
    id: SessionIdSchema,
    routineId: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
    startedAt: z.string().datetime({ offset: true }),
    currentEntry: z
      .object({
        categoryId: CategoryIdSchema,
        level: z.number().int().nonnegative(),
      })
      .strict(),
    completedSetIndexes: CompletedSetIndexesSchema,
    restTimer: z
      .object({
        restEndsAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .nullable(),
    workout: ActiveWorkoutSnapshotSchema.optional(),
  })
  .strict()

const CompletedSessionSchema = z
  .object({
    id: SessionIdSchema,
    routineId: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
    completedAt: z.string().datetime({ offset: true }),
    entries: z.array(SessionEntrySchema).readonly(),
  })
  .strict()

const AssessmentProgressByCategorySchema = z
  .object({
    push: z.number().int().nonnegative(),
    pull: z.number().int().nonnegative(),
    squat: z.number().int().nonnegative(),
    hinge: z.number().int().nonnegative(),
    verticalPush: z.number().int().nonnegative(),
    core: z.number().int().nonnegative(),
  })
  .strict()

export const AssessmentStateSchema = z
  .object({
    status: z.union([z.literal("notStarted"), z.literal("inProgress"), z.literal("complete")]),
    currentCategoryId: CategoryIdSchema.nullable(),
    nextLevelByCategory: AssessmentProgressByCategorySchema,
    lastSafeLevelByCategory: AssessmentProgressByCategorySchema,
  })
  .strict()

export const StoredStateSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    safety: SafetyClearanceSchema,
    nextRoutine: z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
    progress: CategoryProgressByIdSchema,
    completedSessions: z.array(CompletedSessionSchema).readonly(),
    activeSession: ActiveSessionSchema.nullable(),
    assessment: AssessmentStateSchema,
  })
  .strict()

const LegacyLevelsSchema = z
  .object({
    push: z.number().int().nonnegative(),
    pull: z.number().int().nonnegative(),
    squat: z.number().int().nonnegative(),
    hinge: z.number().int().nonnegative(),
    verticalPush: z.number().int().nonnegative(),
    core: z.number().int().nonnegative(),
  })
  .strict()

export const LegacyV0StateSchema = z
  .object({
    levels: LegacyLevelsSchema,
    sessions: z.array(z.unknown()).readonly().optional(),
  })
  .strict()

export type ActiveSession = z.infer<typeof ActiveSessionSchema>
export type AssessmentState = z.infer<typeof AssessmentStateSchema>
export type StoredState = z.infer<typeof StoredStateSchema>

export type StorageRecoveryReason =
  | "malformedJson"
  | "futureVersion"
  | "schemaMismatch"
  | "storageUnavailable"
  | "unknownStorageError"

export type StorageLoadNotice =
  | {
      readonly kind: "recovered"
      readonly reason: StorageRecoveryReason
    }
  | {
      readonly kind: "migrated"
      readonly fromVersion: 0
    }

export type StorageSaveFailureReason =
  | "quotaExceeded"
  | "securityBlocked"
  | "unknownStorageError"
  | "validationFailed"

export type StorageSaveResult =
  | {
      readonly kind: "saved"
    }
  | {
      readonly kind: "failed"
      readonly reason: StorageSaveFailureReason
    }

export function isFutureVersion(value: unknown): boolean {
  const result = z.object({ schemaVersion: z.number().int() }).passthrough().safeParse(value)
  return result.success && result.data.schemaVersion > SCHEMA_VERSION
}

export function createRecoveredNotice(reason: StorageRecoveryReason): StorageLoadNotice {
  return { kind: "recovered", reason }
}

export function createMigratedNotice(): StorageLoadNotice {
  return { kind: "migrated", fromVersion: 0 }
}

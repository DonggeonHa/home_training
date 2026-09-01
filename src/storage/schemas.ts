import { z } from "zod"
import { SCHEMA_VERSION } from "../domain/contracts"
import {
  CategoryIdSchema,
  SafetyClearanceSchema,
  SessionEntrySchema,
  SessionIdSchema,
} from "../domain/schemas"

const CompletedSetIndexesSchema = z.array(z.number().int().nonnegative()).readonly()

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
  })
  .strict()

const CategoryProgressSchema = z
  .object({
    categoryId: CategoryIdSchema,
    level: z.number().int().nonnegative(),
    status: z.union([
      z.literal("unassessed"),
      z.literal("provisional"),
      z.literal("active"),
      z.literal("testUnlocked"),
    ]),
    qualifiedSessionIds: z.array(SessionIdSchema).readonly().optional(),
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
    progress: z
      .object({
        push: CategoryProgressSchema,
        pull: CategoryProgressSchema,
        squat: CategoryProgressSchema,
        hinge: CategoryProgressSchema,
        verticalPush: CategoryProgressSchema,
        core: CategoryProgressSchema,
      })
      .strict(),
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

export type StorageSaveFailureReason = "quotaExceeded" | "securityBlocked" | "unknownStorageError"

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

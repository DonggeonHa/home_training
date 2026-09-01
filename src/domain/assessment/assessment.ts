import type { CategoryId, CategoryProgress, SessionEntry } from "../contracts"
import { entryMeetsMinimum } from "../progression/progression"

export type AssessmentResult =
  | { readonly kind: "provisional"; readonly progress: CategoryProgress }
  | { readonly kind: "fallback"; readonly progress: CategoryProgress }

export type EvaluateAssessmentInput = {
  readonly categoryId: CategoryId
  readonly attempts: readonly SessionEntry[]
  readonly maxEligibleLevel: number
}

export type ProvisionalConfirmationResult =
  | { readonly kind: "confirmed"; readonly progress: CategoryProgress }
  | {
      readonly kind: "fallback"
      readonly reason: "provisional-not-confirmed"
      readonly progress: CategoryProgress
    }

export type ConfirmAssessmentInput = {
  readonly progress: CategoryProgress
  readonly entry: SessionEntry
}

export function evaluateAssessment(input: EvaluateAssessmentInput): AssessmentResult {
  const passedLevels = input.attempts
    .filter((attempt) => attempt.level <= input.maxEligibleLevel)
    .filter(entryMeetsMinimum)
    .map((attempt) => attempt.level)

  const highestLevel = passedLevels.reduce((bestLevel, level) => Math.max(bestLevel, level), -1)
  if (highestLevel < 0) {
    return {
      kind: "fallback",
      progress: {
        categoryId: input.categoryId,
        level: 0,
        status: "active",
        qualifiedSessionIds: [],
      },
    }
  }

  return {
    kind: "provisional",
    progress: {
      categoryId: input.categoryId,
      level: highestLevel,
      status: "provisional",
      qualifiedSessionIds: [],
    },
  }
}

export function confirmAssessmentProvisional(
  input: ConfirmAssessmentInput,
): ProvisionalConfirmationResult {
  if (entryMeetsMinimum(input.entry)) {
    return {
      kind: "confirmed",
      progress: {
        categoryId: input.progress.categoryId,
        level: input.progress.level,
        status: "active",
        qualifiedSessionIds: [],
      },
    }
  }

  return {
    kind: "fallback",
    reason: "provisional-not-confirmed",
    progress: {
      categoryId: input.progress.categoryId,
      level: Math.max(0, input.progress.level - 1),
      status: "active",
      qualifiedSessionIds: [],
    },
  }
}

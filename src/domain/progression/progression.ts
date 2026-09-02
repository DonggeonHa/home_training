import { ASSESSMENT_CAPS } from "../content/common"
import type { CategoryProgress, SessionEntry, SessionId } from "../contracts"
import { getPrescribedSetCount } from "../routines"
import { evaluateEntry, evaluateMetric } from "./metric-evaluation"
import type { RemainingCondition, SessionQualificationResult } from "./progression-types"

export type {
  QualificationReason,
  RemainingCondition,
  SessionQualificationResult,
} from "./progression-types"

export type EvaluateSessionQualificationInput = {
  readonly sessionId: SessionId
  readonly completedSessionCount: number
  readonly progress: CategoryProgress
  readonly entry: SessionEntry
}

export type LevelTestResult =
  | { readonly kind: "promoted"; readonly progress: CategoryProgress }
  | {
      readonly kind: "failed"
      readonly reason: "set-below-minimum"
      readonly progress: CategoryProgress
    }
  | {
      readonly kind: "mixedFallback"
      readonly reason: "first-set-below-minimum"
      readonly progress: CategoryProgress
      readonly testedLevel: number
      readonly fallbackLevel: number
    }

export type EvaluateLevelTestInput = {
  readonly progress: CategoryProgress
  readonly currentLevel: number
  readonly nextLevel: number
  readonly entry: SessionEntry
}

export function evaluateSessionQualification(
  input: EvaluateSessionQualificationInput,
): SessionQualificationResult {
  if (input.completedSessionCount < ASSESSMENT_CAPS.adaptationSessionCount) {
    return {
      kind: "adaptation",
      reason: "adaptation-period",
      prescribedSetCount: getPrescribedSetCount(input.completedSessionCount),
    }
  }

  if (input.progress.qualifiedSessionIds?.includes(input.sessionId) === true) {
    return {
      kind: "notQualified",
      reasons: ["duplicate-session-id"],
      remainingConditions: [
        {
          kind: "distinct-session",
          required: ASSESSMENT_CAPS.qualifyingSessionCount,
          current: input.progress.qualifiedSessionIds.length,
        },
      ],
    }
  }

  const evaluation = evaluateEntry(input.entry, "upper")
  if (evaluation.reasons.length > 0) {
    return {
      kind: "notQualified",
      reasons: evaluation.reasons,
      remainingConditions: evaluation.remainingConditions,
    }
  }

  const qualifiedSessionIds = [...(input.progress.qualifiedSessionIds ?? []), input.sessionId]
  if (qualifiedSessionIds.length >= ASSESSMENT_CAPS.qualifyingSessionCount) {
    return { kind: "testUnlocked", qualifiedSessionIds, status: "testUnlocked" }
  }

  return { kind: "qualified", qualifiedSessionIds, status: "active" }
}

export function getRemainingConditions(entry: SessionEntry): readonly RemainingCondition[] {
  return evaluateMetric(entry.metricRule, entry.sets, "upper").remainingConditions
}

export function evaluateLevelTest(input: EvaluateLevelTestInput): LevelTestResult {
  const evaluation = evaluateEntry(input.entry, "minimum")
  const firstMiss = evaluation.remainingConditions[0]
  if (
    evaluation.reasons.length === 1 &&
    evaluation.reasons[0] === "set-below-upper-bound" &&
    (firstMiss?.kind === "set-upper-bound" || firstMiss?.kind === "side-upper-bound") &&
    firstMiss.setIndex === 0
  ) {
    return {
      kind: "mixedFallback",
      reason: "first-set-below-minimum",
      progress: input.progress,
      testedLevel: input.nextLevel,
      fallbackLevel: input.currentLevel,
    }
  }

  if (evaluation.reasons.length > 0) {
    return { kind: "failed", reason: "set-below-minimum", progress: input.progress }
  }

  return {
    kind: "promoted",
    progress: {
      categoryId: input.progress.categoryId,
      level: input.nextLevel,
      status: "active",
      qualifiedSessionIds: [],
    },
  }
}

export function entryMeetsMinimum(entry: SessionEntry): boolean {
  return evaluateEntry(entry, "minimum").reasons.length === 0
}

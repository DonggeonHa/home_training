import { assertNever } from "../assert-never"
import type { MetricRule, SessionEntry, SetRecord } from "../contracts"
import type { QualificationReason, RemainingCondition } from "./progression-types"

export type GateMode = "minimum" | "upper"

export type Evaluation = {
  readonly reasons: readonly QualificationReason[]
  readonly remainingConditions: readonly RemainingCondition[]
}

type MetricGate = {
  readonly target: number
}

export function evaluateEntry(entry: SessionEntry, mode: GateMode): Evaluation {
  const metricEvaluation = evaluateMetric(entry.metricRule, entry.sets, mode)
  const qualityEvaluation = evaluateQuality(entry.sets)
  const rirEvaluation =
    mode === "upper" ? evaluateFinalRir(entry.metricRule, entry.sets) : emptyEvaluation()
  return combineEvaluations([metricEvaluation, qualityEvaluation, rirEvaluation])
}

export function evaluateMetric(
  rule: MetricRule,
  sets: readonly SetRecord[],
  mode: GateMode,
): Evaluation {
  switch (rule.kind) {
    case "reps":
      return evaluateCountSets({
        sets,
        requiredSetCount: rule.sets,
        gate: { target: mode === "upper" ? rule.max : rule.min },
      })
    case "duration":
      return evaluateCountSets({
        sets,
        requiredSetCount: rule.sets,
        gate: { target: mode === "upper" ? rule.maxSeconds : rule.minSeconds },
      })
    case "tempoReps":
      return evaluateCountSets({
        sets,
        requiredSetCount: rule.sets,
        gate: { target: mode === "upper" ? rule.max : rule.min },
      })
    case "terminal":
      return { reasons: ["terminal-level"], remainingConditions: [] }
    default:
      return assertNever(rule)
  }
}

function evaluateCountSets(input: {
  readonly sets: readonly SetRecord[]
  readonly requiredSetCount: number
  readonly gate: MetricGate
}): Evaluation {
  const setCountEvaluation =
    input.sets.length < input.requiredSetCount
      ? {
          reasons: ["missing-required-set" as const],
          remainingConditions: [
            {
              kind: "required-set-count" as const,
              required: input.requiredSetCount,
              current: input.sets.length,
            },
          ],
        }
      : emptyEvaluation()
  const setEvaluations = input.sets
    .slice(0, input.requiredSetCount)
    .map((set, setIndex) => evaluateSetValue({ set, setIndex, gate: input.gate }))
  return combineEvaluations([setCountEvaluation, ...setEvaluations])
}

function evaluateSetValue(input: {
  readonly set: SetRecord
  readonly setIndex: number
  readonly gate: MetricGate
}): Evaluation {
  switch (input.set.kind) {
    case "single":
      return input.set.value >= input.gate.target
        ? emptyEvaluation()
        : {
            reasons: ["set-below-upper-bound"],
            remainingConditions: [
              {
                kind: "set-upper-bound",
                setIndex: input.setIndex,
                required: input.gate.target,
                current: input.set.value,
              },
            ],
          }
    case "perSide":
      return combineEvaluations([
        evaluateSide({
          side: "left",
          value: input.set.left,
          setIndex: input.setIndex,
          gate: input.gate,
        }),
        evaluateSide({
          side: "right",
          value: input.set.right,
          setIndex: input.setIndex,
          gate: input.gate,
        }),
      ])
    default:
      return assertNever(input.set)
  }
}

function evaluateSide(input: {
  readonly side: "left" | "right"
  readonly value: number
  readonly setIndex: number
  readonly gate: MetricGate
}): Evaluation {
  return input.value >= input.gate.target
    ? emptyEvaluation()
    : {
        reasons: ["set-below-upper-bound"],
        remainingConditions: [
          {
            kind: "side-upper-bound",
            setIndex: input.setIndex,
            side: input.side,
            required: input.gate.target,
            current: input.value,
          },
        ],
      }
}

function evaluateQuality(sets: readonly SetRecord[]): Evaluation {
  const reasons = sets.flatMap((set) => [
    ...(set.quality.pain ? (["concerning-pain"] as const) : []),
    ...(set.quality.form === "good" ? [] : (["form-not-good"] as const)),
    ...(set.quality.rom === "full" ? [] : (["rom-not-full"] as const)),
  ])
  return { reasons: uniqueReasons(reasons), remainingConditions: [] }
}

function evaluateFinalRir(rule: MetricRule, sets: readonly SetRecord[]): Evaluation {
  switch (rule.kind) {
    case "reps":
    case "tempoReps": {
      if (rule.rir === undefined) {
        return emptyEvaluation()
      }
      const finalSet = sets[rule.sets - 1]
      const finalRir = finalSet?.rir
      return finalRir !== undefined && finalRir >= rule.rir.min && finalRir <= rule.rir.max
        ? emptyEvaluation()
        : {
            reasons: ["final-rir-out-of-range"],
            remainingConditions: [
              {
                kind: "final-rir",
                min: rule.rir.min,
                max: rule.rir.max,
                current: finalRir ?? null,
              },
            ],
          }
    }
    case "duration":
    case "terminal":
      return emptyEvaluation()
    default:
      return assertNever(rule)
  }
}

function combineEvaluations(evaluations: readonly Evaluation[]): Evaluation {
  return {
    reasons: uniqueReasons(evaluations.flatMap((evaluation) => evaluation.reasons)),
    remainingConditions: evaluations.flatMap((evaluation) => evaluation.remainingConditions),
  }
}

function uniqueReasons(reasons: readonly QualificationReason[]): readonly QualificationReason[] {
  return [...new Set(reasons)]
}

function emptyEvaluation(): Evaluation {
  return { reasons: [], remainingConditions: [] }
}

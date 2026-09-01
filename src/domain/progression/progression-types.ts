import type { SessionId } from "../contracts"

export type QualificationReason =
  | "duplicate-session-id"
  | "set-below-upper-bound"
  | "missing-required-set"
  | "final-rir-out-of-range"
  | "form-not-good"
  | "rom-not-full"
  | "concerning-pain"
  | "terminal-level"

export type RemainingCondition =
  | {
      readonly kind: "set-upper-bound"
      readonly setIndex: number
      readonly required: number
      readonly current: number
    }
  | {
      readonly kind: "side-upper-bound"
      readonly setIndex: number
      readonly side: "left" | "right"
      readonly required: number
      readonly current: number
    }
  | { readonly kind: "required-set-count"; readonly required: number; readonly current: number }
  | {
      readonly kind: "final-rir"
      readonly min: number
      readonly max: number
      readonly current: number | null
    }
  | { readonly kind: "distinct-session"; readonly required: number; readonly current: number }

export type SessionQualificationResult =
  | {
      readonly kind: "adaptation"
      readonly reason: "adaptation-period"
      readonly prescribedSetCount: number
    }
  | {
      readonly kind: "notQualified"
      readonly reasons: readonly QualificationReason[]
      readonly remainingConditions: readonly RemainingCondition[]
    }
  | {
      readonly kind: "qualified"
      readonly qualifiedSessionIds: readonly SessionId[]
      readonly status: "active"
    }
  | {
      readonly kind: "testUnlocked"
      readonly qualifiedSessionIds: readonly SessionId[]
      readonly status: "testUnlocked"
    }

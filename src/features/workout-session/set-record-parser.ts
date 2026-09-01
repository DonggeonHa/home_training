import { assertNever } from "../../domain/assert-never"
import type { SetRecord } from "../../domain/contracts"
import type { WorkoutSetDraft } from "./types"

type ParseSetRecordInput = {
  readonly draft: WorkoutSetDraft
  readonly acceptsRir: boolean
}

export function parseSetRecord(input: ParseSetRecordInput): SetRecord | null {
  const rir = input.acceptsRir ? parseOptionalNumber(input.draft.rirText) : undefined
  const loadKg = parseOptionalNumber(input.draft.loadText)
  if (rir === null || loadKg === null) {
    return null
  }

  switch (input.draft.kind) {
    case "single": {
      const value = parseRequiredNumber(input.draft.valueText)
      return value === null
        ? null
        : {
            kind: "single",
            value,
            ...(rir === undefined ? {} : { rir }),
            ...(loadKg === undefined ? {} : { loadKg }),
            quality: input.draft.quality,
          }
    }
    case "perSide": {
      const left = parseRequiredNumber(input.draft.leftText)
      const right = parseRequiredNumber(input.draft.rightText)
      return left === null || right === null
        ? null
        : {
            kind: "perSide",
            left,
            right,
            ...(rir === undefined ? {} : { rir }),
            ...(loadKg === undefined ? {} : { loadKg }),
            quality: input.draft.quality,
          }
    }
    /* c8 ignore next 2 */
    default:
      return assertNever(input.draft)
  }
}

function parseRequiredNumber(value: string): number | null {
  const parsed = parseOptionalNumber(value)
  return parsed === undefined ? null : parsed
}

function parseOptionalNumber(value: string): number | undefined | null {
  if (value.trim() === "") {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

import { assertNever } from "../../domain/assert-never"
import type { SetRecord } from "../../domain/contracts"
import type { WorkoutSetDraft } from "./types"

type ParseSetRecordInput = {
  readonly draft: WorkoutSetDraft
  readonly acceptsRir: boolean
}

export function parseSetRecord(input: ParseSetRecordInput): SetRecord | null {
  const rir = input.acceptsRir ? parseOptionalRir(input.draft.rirText) : undefined
  const loadKg = parseOptionalLoad(input.draft.loadText)
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

export function readSetRecordInputError(input: ParseSetRecordInput): string | null {
  if (input.acceptsRir && parseOptionalRir(input.draft.rirText) === null) {
    return "RIR은 0부터 5까지의 정수로 입력하세요."
  }
  if (parseOptionalLoad(input.draft.loadText) === null) {
    return "중량은 0 이상의 숫자로 입력하세요."
  }

  switch (input.draft.kind) {
    case "single":
      return parseRequiredInteger(input.draft.valueText) === null
        ? "반복 수와 초는 0 이상의 정수로 입력하세요."
        : null
    case "perSide":
      return parseRequiredInteger(input.draft.leftText) === null ||
        parseRequiredInteger(input.draft.rightText) === null
        ? "좌우 기록은 0 이상의 정수로 입력하세요."
        : null
    /* c8 ignore next 2 */
    default:
      return assertNever(input.draft)
  }
}

function parseRequiredNumber(value: string): number | null {
  const parsed = parseOptionalInteger(value)
  return parsed === undefined ? null : parsed
}

function parseRequiredInteger(value: string): number | null {
  const parsed = parseOptionalInteger(value)
  return parsed === undefined ? null : parsed
}

function parseOptionalInteger(value: string): number | undefined | null {
  if (value.trim() === "") {
    return undefined
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function parseOptionalRir(value: string): number | undefined | null {
  const parsed = parseOptionalInteger(value)
  return parsed === null || parsed === undefined || parsed <= 5 ? parsed : null
}

function parseOptionalLoad(value: string): number | undefined | null {
  if (value.trim() === "") {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

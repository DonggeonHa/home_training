import { assertNever } from "../assert-never"
import type { CategoryId, CompletedSession, SessionEntry } from "../contracts"

export type LatestEntryResult =
  | {
      readonly kind: "found"
      readonly sessionId: string
      readonly completedAt: string
      readonly entry: SessionEntry
    }
  | { readonly kind: "notFound" }

export type SingleUnit = "reps" | "seconds"
export type ChartUnit = SingleUnit | "kg" | "perSideReps"

export type SinglePr = { readonly unit: SingleUnit; readonly value: number }
export type LoadPr = { readonly unit: "kg"; readonly value: number }
export type PerSidePr = {
  readonly unit: "perSideReps"
  readonly left: number
  readonly right: number
}

export type SameLevelPrResult =
  | {
      readonly kind: "found"
      readonly bestSingleValue?: SinglePr | undefined
      readonly bestLoadKg?: LoadPr | undefined
      readonly bestPerSideValue?: PerSidePr | undefined
    }
  | { readonly kind: "notFound" }

export type LevelTimelinePoint = {
  readonly completedAt: string
  readonly level: number
}

export type SingleChartPoint = {
  readonly completedAt: string
  readonly setIndex: number
  readonly value: number
}

export type PerSideChartPoint = {
  readonly completedAt: string
  readonly setIndex: number
  readonly left: number
  readonly right: number
}

export type RawUnitChartSeries =
  | { readonly unit: "reps"; readonly points: readonly SingleChartPoint[] }
  | { readonly unit: "kg"; readonly points: readonly SingleChartPoint[] }
  | { readonly unit: "seconds"; readonly points: readonly SingleChartPoint[] }
  | { readonly unit: "perSideReps"; readonly points: readonly PerSideChartPoint[] }

export type CategoryHistoryInput = {
  readonly sessions: readonly CompletedSession[]
  readonly categoryId: CategoryId
}

export type SameLevelPrInput = CategoryHistoryInput & {
  readonly level: number
}

type DatedEntry = {
  readonly session: CompletedSession
  readonly entry: SessionEntry
}

export function getLatestEntry(input: CategoryHistoryInput): LatestEntryResult {
  const datedEntries = getDatedEntries(input)
  const latest = datedEntries.at(-1)
  return latest === undefined
    ? { kind: "notFound" }
    : {
        kind: "found",
        sessionId: latest.session.id,
        completedAt: latest.session.completedAt,
        entry: latest.entry,
      }
}

export function getSameLevelPr(input: SameLevelPrInput): SameLevelPrResult {
  const entries = getDatedEntries(input).filter(
    (datedEntry) => datedEntry.entry.level === input.level,
  )
  if (entries.length === 0) {
    return { kind: "notFound" }
  }

  const singleValues = entries.flatMap((datedEntry) => getSingleValues(datedEntry.entry))
  const loadValues = entries.flatMap((datedEntry) => getLoadValues(datedEntry.entry))
  const perSideValues = entries.flatMap((datedEntry) => getPerSideValues(datedEntry.entry))
  const bestLoad = maxNumber(loadValues)
  return {
    kind: "found",
    bestSingleValue: bestSingleValue(singleValues),
    bestLoadKg: bestLoad === undefined ? undefined : { unit: "kg", value: bestLoad },
    bestPerSideValue: bestPerSide(perSideValues),
  }
}

export function getLevelTimeline(input: CategoryHistoryInput): readonly LevelTimelinePoint[] {
  const timeline: LevelTimelinePoint[] = []
  for (const datedEntry of getDatedEntries(input)) {
    if (timeline.at(-1)?.level !== datedEntry.entry.level) {
      timeline.push({ completedAt: datedEntry.session.completedAt, level: datedEntry.entry.level })
    }
  }
  return timeline
}

export function getRawUnitChartSeries(input: CategoryHistoryInput): readonly RawUnitChartSeries[] {
  const datedEntries = getDatedEntries(input)
  const reps = datedEntries.flatMap((datedEntry) => getSingleChartPoints(datedEntry, "reps"))
  const load = datedEntries.flatMap(getLoadChartPoints)
  const seconds = datedEntries.flatMap((datedEntry) => getSingleChartPoints(datedEntry, "seconds"))
  const perSide = datedEntries.flatMap(getPerSideChartPoints)
  return [
    ...(reps.length > 0 ? [{ unit: "reps" as const, points: reps }] : []),
    ...(load.length > 0 ? [{ unit: "kg" as const, points: load }] : []),
    ...(seconds.length > 0 ? [{ unit: "seconds" as const, points: seconds }] : []),
    ...(perSide.length > 0 ? [{ unit: "perSideReps" as const, points: perSide }] : []),
  ]
}

function getDatedEntries(input: CategoryHistoryInput): readonly DatedEntry[] {
  return input.sessions
    .flatMap((session) =>
      session.entries
        .filter((entry) => entry.categoryId === input.categoryId)
        .map((entry) => ({ session, entry })),
    )
    .sort((left, right) => left.session.completedAt.localeCompare(right.session.completedAt))
}

function getSingleValues(
  entry: SessionEntry,
): readonly { readonly unit: SingleUnit; readonly value: number }[] {
  switch (entry.metricRule.kind) {
    case "reps":
    case "tempoReps":
      return entry.sets.flatMap((set) =>
        set.kind === "single" ? [{ unit: "reps" as const, value: set.value }] : [],
      )
    case "duration":
      return entry.sets.flatMap((set) =>
        set.kind === "single" ? [{ unit: "seconds" as const, value: set.value }] : [],
      )
    case "terminal":
      return []
    default:
      return assertNever(entry.metricRule)
  }
}

function getLoadValues(entry: SessionEntry): readonly number[] {
  return entry.sets.flatMap((set) => (set.loadKg === undefined ? [] : [set.loadKg]))
}

function getPerSideValues(entry: SessionEntry): readonly PerSidePr[] {
  return entry.sets.flatMap((set) =>
    set.kind === "perSide"
      ? [{ unit: "perSideReps" as const, left: set.left, right: set.right }]
      : [],
  )
}

function bestSingleValue(
  values: readonly { readonly unit: SingleUnit; readonly value: number }[],
): SinglePr | undefined {
  const repsMax = maxNumber(
    values.filter((value) => value.unit === "reps").map((value) => value.value),
  )
  const secondsMax = maxNumber(
    values.filter((value) => value.unit === "seconds").map((value) => value.value),
  )
  if (repsMax !== undefined) {
    return { unit: "reps", value: repsMax }
  }
  return secondsMax === undefined ? undefined : { unit: "seconds", value: secondsMax }
}

function bestPerSide(values: readonly PerSidePr[]): PerSidePr | undefined {
  return values.reduce<PerSidePr | undefined>((best, value) => {
    const bestTotal = best === undefined ? -1 : best.left + best.right
    const valueTotal = value.left + value.right
    return valueTotal > bestTotal ? value : best
  }, undefined)
}

function maxNumber(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : Math.max(...values)
}

function getSingleChartPoints(
  datedEntry: DatedEntry,
  unit: SingleUnit,
): readonly SingleChartPoint[] {
  return getSingleValues(datedEntry.entry)
    .filter((value) => value.unit === unit)
    .map((value, setIndex) => ({
      completedAt: datedEntry.session.completedAt,
      setIndex,
      value: value.value,
    }))
}

function getLoadChartPoints(datedEntry: DatedEntry): readonly SingleChartPoint[] {
  return datedEntry.entry.sets.flatMap((set, setIndex) =>
    set.loadKg === undefined
      ? []
      : [{ completedAt: datedEntry.session.completedAt, setIndex, value: set.loadKg }],
  )
}

function getPerSideChartPoints(datedEntry: DatedEntry): readonly PerSideChartPoint[] {
  return datedEntry.entry.sets.flatMap((set, setIndex) =>
    set.kind === "perSide"
      ? [
          {
            completedAt: datedEntry.session.completedAt,
            setIndex,
            left: set.left,
            right: set.right,
          },
        ]
      : [],
  )
}

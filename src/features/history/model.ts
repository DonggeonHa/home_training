import { currentCategoryKey } from "../../app/store/selectors"
import { type CatalogCategory, EXERCISE_CATALOG } from "../../domain/catalog"
import type { CategoryId, CompletedSession, SessionEntry } from "../../domain/contracts"
import {
  getLatestEntry,
  getLevelTimeline,
  getRawUnitChartSeries,
  getSameLevelPr,
  type PerSideChartPoint,
  type SingleChartPoint,
} from "../../domain/history/history"
import type { StoredState } from "../../storage"
import { formatSets } from "../dashboard/model"

export type HistoryCategoryFilter = "all" | CategoryId

export type HistorySummary = {
  readonly latest: string
  readonly levelTimeline: string
  readonly sameLevelPr: string
}

type CategoryLabeledPoint = {
  readonly categoryTitle: string
}

export type SingleHistoryChartPoint = SingleChartPoint & CategoryLabeledPoint
export type PerSideHistoryChartPoint = PerSideChartPoint & CategoryLabeledPoint

export type HistoryChartSeries =
  | { readonly unit: "reps"; readonly points: readonly SingleHistoryChartPoint[] }
  | { readonly unit: "kg"; readonly points: readonly SingleHistoryChartPoint[] }
  | { readonly unit: "seconds"; readonly points: readonly SingleHistoryChartPoint[] }
  | { readonly unit: "perSideReps"; readonly points: readonly PerSideHistoryChartPoint[] }

export function entriesForFilter(
  sessions: readonly CompletedSession[],
  filter: HistoryCategoryFilter,
): readonly CompletedSession[] {
  if (filter === "all") {
    return sessions
  }
  const filtered: CompletedSession[] = []
  for (const session of sessions) {
    const entries = session.entries.filter((entry) => entry.categoryId === filter)
    if (entries.length > 0) {
      filtered.push({ ...session, entries })
    }
  }
  return filtered
}

export function buildHistorySummary(state: StoredState, category: CatalogCategory): HistorySummary {
  const progress = state.progress[currentCategoryKey(category.id)]
  const latest = getLatestEntry({ sessions: state.completedSessions, categoryId: category.id })
  const pr = getSameLevelPr({
    sessions: state.completedSessions,
    categoryId: category.id,
    level: progress.level,
  })
  const timeline = getLevelTimeline({ sessions: state.completedSessions, categoryId: category.id })

  return {
    latest: latest.kind === "found" ? formatSets(latest.entry.sets) : "아직 없음",
    levelTimeline:
      timeline.length === 0 ? "아직 없음" : timeline.map((point) => `Lv.${point.level}`).join(", "),
    sameLevelPr: pr.kind === "found" ? formatSameLevelPr(pr) : "아직 없음",
  }
}

export function chartSeriesForFilter(
  sessions: readonly CompletedSession[],
  filter: HistoryCategoryFilter,
): readonly HistoryChartSeries[] {
  const categories =
    filter === "all" ? EXERCISE_CATALOG : EXERCISE_CATALOG.filter((c) => c.id === filter)
  const reps: SingleHistoryChartPoint[] = []
  const kg: SingleHistoryChartPoint[] = []
  const seconds: SingleHistoryChartPoint[] = []
  const perSide: PerSideHistoryChartPoint[] = []

  for (const category of categories) {
    for (const series of getRawUnitChartSeries({ sessions, categoryId: category.id })) {
      switch (series.unit) {
        case "reps":
          reps.push(...labelSinglePoints(series.points, category.title))
          break
        case "kg":
          kg.push(...labelSinglePoints(series.points, category.title))
          break
        case "seconds":
          seconds.push(...labelSinglePoints(series.points, category.title))
          break
        case "perSideReps":
          perSide.push(...labelPerSidePoints(series.points, category.title))
          break
      }
    }
  }

  return [
    ...(reps.length > 0 ? [{ unit: "reps" as const, points: reps }] : []),
    ...(kg.length > 0 ? [{ unit: "kg" as const, points: kg }] : []),
    ...(seconds.length > 0 ? [{ unit: "seconds" as const, points: seconds }] : []),
    ...(perSide.length > 0 ? [{ unit: "perSideReps" as const, points: perSide }] : []),
  ]
}

export function categoryTitleForEntry(entry: SessionEntry): string {
  return EXERCISE_CATALOG.find((category) => category.id === entry.categoryId)?.title ?? "UNKNOWN"
}

function labelSinglePoints(
  points: readonly SingleChartPoint[],
  categoryTitle: string,
): readonly SingleHistoryChartPoint[] {
  return points.map((point) => ({ ...point, categoryTitle }))
}

function labelPerSidePoints(
  points: readonly PerSideChartPoint[],
  categoryTitle: string,
): readonly PerSideHistoryChartPoint[] {
  return points.map((point) => ({ ...point, categoryTitle }))
}

type FoundPr = Exclude<ReturnType<typeof getSameLevelPr>, { readonly kind: "notFound" }>

function formatSameLevelPr(pr: FoundPr): string {
  if (pr.bestPerSideValue !== undefined) {
    return `좌 ${pr.bestPerSideValue.left}회 / 우 ${pr.bestPerSideValue.right}회`
  }
  if (pr.bestSingleValue !== undefined) {
    return pr.bestSingleValue.unit === "seconds"
      ? `${pr.bestSingleValue.value}초`
      : `${pr.bestSingleValue.value}회`
  }
  if (pr.bestLoadKg !== undefined) {
    return `${pr.bestLoadKg.value}kg`
  }
  return "아직 없음"
}

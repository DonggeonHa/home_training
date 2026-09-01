import { currentCategoryKey } from "../../app/store/selectors"
import { type CatalogCategory, EXERCISE_CATALOG } from "../../domain/catalog"
import type { ProgressStatus, SetRecord } from "../../domain/contracts"
import { getLatestEntry, getSameLevelPr } from "../../domain/history/history"
import type { StoredState } from "../../storage"

export type CategoryDashboardCard = {
  readonly category: CatalogCategory
  readonly currentLevel: number
  readonly status: ProgressStatus
  readonly statusLabel: string
  readonly currentExercise: string
  readonly nextExercise: string
  readonly latestRecord: string
  readonly sameLevelPr: string
  readonly remainingCondition: string
  readonly progressValue: number
}

export function buildDashboardCards(state: StoredState): readonly CategoryDashboardCard[] {
  return EXERCISE_CATALOG.map((category) => buildDashboardCard(state, category))
}

export function buildDashboardCard(
  state: StoredState,
  category: CatalogCategory,
): CategoryDashboardCard {
  const progress = state.progress[currentCategoryKey(category.id)]
  const currentLevel = category.levels.find((level) => level.level === progress.level)
  const nextLevel = category.levels.find((level) => level.level > progress.level)
  const latest = getLatestEntry({ sessions: state.completedSessions, categoryId: category.id })
  const pr = getSameLevelPr({
    sessions: state.completedSessions,
    categoryId: category.id,
    level: progress.level,
  })

  return {
    category,
    currentLevel: progress.level,
    status: progress.status,
    statusLabel: statusLabel(progress.status),
    currentExercise: currentLevel?.name ?? "레벨 확인 필요",
    nextExercise: nextLevel === undefined ? "최종 목표" : `Lv.${nextLevel.level} ${nextLevel.name}`,
    latestRecord: latest.kind === "found" ? formatSets(latest.entry.sets) : "아직 없음",
    sameLevelPr: pr.kind === "found" ? formatPr(pr) : "아직 없음",
    remainingCondition: remainingCondition(
      progress.status,
      progress.qualifiedSessionIds?.length ?? 0,
    ),
    progressValue: Math.min(progress.level + 1, category.levels.length),
  }
}

export function adaptationProgressLabel(completedCount: number): string {
  return `적응기 ${Math.min(completedCount, 6)} / 6회`
}

export function statusLabel(status: ProgressStatus): string {
  switch (status) {
    case "unassessed":
      return "평가 필요"
    case "provisional":
      return "임시 레벨"
    case "active":
      return "진행 중"
    case "testUnlocked":
      return "테스트 가능"
  }
}

function remainingCondition(status: ProgressStatus, qualifiedCount: number): string {
  switch (status) {
    case "unassessed":
      return "안전 확인과 레벨 평가 필요"
    case "provisional":
      return "첫 6회 적응기 완료 후 목표 세션 2회"
    case "active":
      return `목표 달성 세션 ${qualifiedCount} / 2회`
    case "testUnlocked":
      return "다음 레벨 테스트 가능"
  }
}

export function formatSets(sets: readonly SetRecord[]): string {
  if (sets.length === 0) {
    return "기록 없음"
  }
  return sets.map(formatSet).join(" / ")
}

function formatSet(set: SetRecord): string {
  switch (set.kind) {
    case "single":
      return `${set.value}회`
    case "perSide":
      return `좌 ${set.left}회 / 우 ${set.right}회`
  }
}

type PrLike = Exclude<ReturnType<typeof getSameLevelPr>, { readonly kind: "notFound" }>

function formatPr(pr: PrLike): string {
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

import { currentCategoryKey } from "../../app/store/selectors"
import { type CatalogCategory, type CatalogLevel, EXERCISE_CATALOG } from "../../domain/catalog"
import type { ProgressStatus } from "../../domain/contracts"
import type { StoredState } from "../../storage"

export type LevelViewStatus = "cleared" | "current" | "testable" | "locked" | "terminal"

export type SkillTreeLevel = {
  readonly level: CatalogLevel
  readonly status: LevelViewStatus
  readonly statusLabel: string
}

export type SkillTreeCategory = {
  readonly category: CatalogCategory
  readonly levels: readonly SkillTreeLevel[]
}

export function buildSkillTrees(state: StoredState): readonly SkillTreeCategory[] {
  return EXERCISE_CATALOG.map((category) => {
    const progress = state.progress[currentCategoryKey(category.id)]
    return {
      category,
      levels: category.levels.map((level) => ({
        level,
        status: levelStatus(level, progress.level, progress.status),
        statusLabel: levelStatusLabel(levelStatus(level, progress.level, progress.status)),
      })),
    }
  })
}

function levelStatus(
  level: CatalogLevel,
  currentLevel: number,
  progressStatus: ProgressStatus,
): LevelViewStatus {
  if (!level.promotable) {
    return "terminal"
  }
  if (level.level < currentLevel) {
    return "cleared"
  }
  if (level.level === currentLevel) {
    return "current"
  }
  if (level.level === currentLevel + 1 && progressStatus === "testUnlocked") {
    return "testable"
  }
  return "locked"
}

function levelStatusLabel(status: LevelViewStatus): string {
  switch (status) {
    case "cleared":
      return "클리어"
    case "current":
      return "현재"
    case "testable":
      return "테스트 가능"
    case "locked":
      return "잠김"
    case "terminal":
      return "터미널 목표"
  }
}

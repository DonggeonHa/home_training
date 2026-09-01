import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import type { StoredState } from "../../storage"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { buildHistorySummary, chartSeriesForFilter, entriesForFilter } from "./model"

const pushId = CategoryIdSchema.parse("push")
const squatId = CategoryIdSchema.parse("squat")

function stateWithMixedHistory(): StoredState {
  const base: StoredState = createCompletedOnboardingState()
  return {
    ...base,
    progress: {
      ...base.progress,
      push: { categoryId: pushId, level: 0, status: "active" },
      squat: { categoryId: squatId, level: 4, status: "active" },
    },
    completedSessions: [
      {
        id: SessionIdSchema.parse("66666666-6666-4666-8666-666666666666"),
        routineId: "A",
        completedAt: "2026-09-01T09:00:00.000Z",
        entries: [
          {
            categoryId: pushId,
            level: 0,
            exerciseName: "벽 푸시업",
            metricRule: { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" },
            sets: [
              {
                kind: "single",
                value: 15,
                loadKg: 5,
                quality: { pain: false, form: "good", rom: "full" },
              },
            ],
          },
          {
            categoryId: squatId,
            level: 4,
            exerciseName: "리버스 런지",
            metricRule: { kind: "reps", min: 10, max: 12, sets: 3, laterality: "perSide" },
            sets: [
              {
                kind: "perSide",
                left: 9,
                right: 8,
                quality: { pain: false, form: "good", rom: "full" },
              },
            ],
          },
        ],
      },
    ],
  }
}

describe("history model", () => {
  it("filters sessions to only the selected category entries", () => {
    const state = stateWithMixedHistory()
    const filtered = entriesForFilter(state.completedSessions, pushId)

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.entries).toHaveLength(1)
    expect(filtered[0]?.entries[0]?.exerciseName).toBe("벽 푸시업")
    expect(entriesForFilter(state.completedSessions, "all")).toHaveLength(1)
  })

  it("summarizes latest, PR, and timeline for populated and empty category history", () => {
    const state = stateWithMixedHistory()
    const pushSummary = buildHistorySummary(state, {
      id: pushId,
      title: "PUSH",
      muscles: [],
      warmup: [],
      instructions: [],
      mistakes: [],
      stopSignals: [],
      levels: [],
    })
    const emptySummary = buildHistorySummary(createCompletedOnboardingState(), {
      id: pushId,
      title: "PUSH",
      muscles: [],
      warmup: [],
      instructions: [],
      mistakes: [],
      stopSignals: [],
      levels: [],
    })

    expect(pushSummary.latest).toBe("15회")
    expect(pushSummary.sameLevelPr).toBe("15회")
    expect(pushSummary.levelTimeline).toBe("Lv.0")
    expect(emptySummary.latest).toBe("아직 없음")
    expect(emptySummary.sameLevelPr).toBe("아직 없음")
    expect(emptySummary.levelTimeline).toBe("아직 없음")
  })

  it("returns raw chart series by unit without cross-unit aggregation", () => {
    const series = chartSeriesForFilter(stateWithMixedHistory().completedSessions, "all")

    expect(series.map((item) => item.unit)).toEqual(["reps", "kg", "perSideReps"])
    expect(series.find((item) => item.unit === "reps")?.points).toHaveLength(1)
    expect(series.find((item) => item.unit === "kg")?.points).toHaveLength(1)
    expect(series.find((item) => item.unit === "perSideReps")?.points).toHaveLength(1)
  })
})

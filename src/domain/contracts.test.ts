import { describe, expect, it } from "vitest"
import { assertNever } from "./assert-never"
import {
  type AppState,
  CATEGORY_IDS,
  type MetricRule,
  type ProgressStatus,
  type SafetyClearance,
  SCHEMA_VERSION,
} from "./contracts"
import { AppStateSchema, CategoryIdSchema, SafetyClearanceSchema, SessionIdSchema } from "./schemas"

describe("domain contracts", () => {
  it("accepts exactly the six training category IDs", () => {
    expect(CATEGORY_IDS).toEqual(["push", "pull", "squat", "hinge", "verticalPush", "core"])

    for (const categoryId of CATEGORY_IDS) {
      expect(CategoryIdSchema.safeParse(categoryId).success).toBe(true)
    }

    expect(CategoryIdSchema.safeParse("cardio").success).toBe(false)
  })

  it("types readonly progress, session, app-state, and terminal metric shapes", () => {
    const unassessed: ProgressStatus = "unassessed"
    const provisional: ProgressStatus = "provisional"
    const active: ProgressStatus = "active"
    const testUnlocked: ProgressStatus = "testUnlocked"
    const statuses: readonly ProgressStatus[] = [unassessed, provisional, active, testUnlocked]
    const terminalRule: MetricRule = {
      kind: "terminal",
      label: "상급 목표",
      laterality: "none",
    }
    const state: AppState = {
      schemaVersion: SCHEMA_VERSION,
      safety: { cleared: true, clearedAt: "2026-09-01T00:00:00.000Z" },
      nextRoutine: "A",
      progress: {
        push: { categoryId: CategoryIdSchema.parse("push"), level: 0, status: unassessed },
        pull: { categoryId: CategoryIdSchema.parse("pull"), level: 0, status: provisional },
        squat: { categoryId: CategoryIdSchema.parse("squat"), level: 0, status: active },
        hinge: { categoryId: CategoryIdSchema.parse("hinge"), level: 0, status: testUnlocked },
        verticalPush: {
          categoryId: CategoryIdSchema.parse("verticalPush"),
          level: 0,
          status: active,
        },
        core: { categoryId: CategoryIdSchema.parse("core"), level: 0, status: active },
      },
      completedSessions: [
        {
          id: SessionIdSchema.parse("11111111-1111-4111-8111-111111111111"),
          routineId: "A",
          completedAt: "2026-09-01T00:00:00.000Z",
          entries: [],
        },
      ],
    }

    expect(statuses).toEqual(["unassessed", "provisional", "active", "testUnlocked"])
    expect(terminalRule.kind).toBe("terminal")
    expect(AppStateSchema.safeParse(state).success).toBe(true)
  })

  it("keeps persisted safety clearance limited to cleared boolean and timestamp", () => {
    const safety: SafetyClearance = {
      cleared: true,
      clearedAt: "2026-09-01T00:00:00.000Z",
    }

    expect(SafetyClearanceSchema.safeParse(safety).success).toBe(true)
    expect(
      SafetyClearanceSchema.safeParse({
        cleared: true,
        clearedAt: "2026-09-01T00:00:00.000Z",
        answers: { chestPain: false },
      }).success,
    ).toBe(false)
  })

  it("forces exhaustive metric switches through assertNever", () => {
    function metricLabel(rule: MetricRule): string {
      switch (rule.kind) {
        case "reps":
          return "reps"
        case "duration":
          return "duration"
        case "tempoReps":
          return "tempo"
        case "terminal":
          return "terminal"
        default:
          return assertNever(rule)
      }
    }

    expect(metricLabel({ kind: "terminal", label: "상급 목표", laterality: "none" })).toBe(
      "terminal",
    )
  })
})

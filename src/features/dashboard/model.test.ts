import { describe, expect, it } from "vitest"
import type { CategoryProgress } from "../../domain/contracts"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import type { StoredState } from "../../storage"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { buildDashboardCards, formatSets, statusLabel } from "./model"

const pushId = CategoryIdSchema.parse("push")
const coreId = CategoryIdSchema.parse("core")
const sessionId = SessionIdSchema.parse("55555555-5555-4555-8555-555555555555")
const terminalSessionId = SessionIdSchema.parse("77777777-7777-4777-8777-777777777777")

function stateWithPushProgress(progress: CategoryProgress): StoredState {
  const base: StoredState = createCompletedOnboardingState()
  return {
    ...base,
    progress: { ...base.progress, push: progress },
  }
}

describe("dashboard model", () => {
  it("formats every progress status and remaining condition", () => {
    const statuses = [
      ["unassessed", "평가 필요", "안전 확인과 레벨 평가 필요"],
      ["provisional", "임시 레벨", "첫 6회 적응기 완료 후 목표 세션 2회"],
      ["active", "진행 중", "목표 달성 세션 1 / 2회"],
      ["testUnlocked", "테스트 가능", "다음 레벨 테스트 가능"],
    ] as const

    for (const [status, label, remaining] of statuses) {
      const cards = buildDashboardCards(
        stateWithPushProgress({
          categoryId: pushId,
          level: 0,
          status,
          qualifiedSessionIds: [sessionId],
        }),
      )

      expect(statusLabel(status)).toBe(label)
      expect(cards[0]?.remainingCondition).toBe(remaining)
    }
  })

  it("formats single, per-side, duration, load, and empty records without unit mixing", () => {
    expect(
      formatSets([
        { kind: "single", value: 30, quality: { pain: false, form: "good", rom: "full" } },
      ]),
    ).toBe("30회")
    expect(
      formatSets([
        {
          kind: "perSide",
          left: 8,
          right: 7,
          quality: { pain: false, form: "good", rom: "full" },
        },
      ]),
    ).toBe("좌 8회 / 우 7회")
    expect(formatSets([])).toBe("기록 없음")
  })

  it("formats dashboard PRs for seconds, per-side, load-only, and empty terminal records", () => {
    const base: StoredState = createCompletedOnboardingState()
    const state = {
      ...base,
      progress: {
        ...base.progress,
        core: { categoryId: coreId, level: 1, status: "active" },
        squat: { ...base.progress.squat, level: 4, status: "active" },
        verticalPush: { ...base.progress.verticalPush, level: 8, status: "active" },
      },
      completedSessions: [
        {
          id: sessionId,
          routineId: "A",
          completedAt: "2026-09-01T09:00:00.000Z",
          entries: [
            {
              categoryId: coreId,
              level: 1,
              exerciseName: "플랭크",
              metricRule: {
                kind: "duration",
                minSeconds: 45,
                maxSeconds: 45,
                sets: 3,
                laterality: "none",
              },
              sets: [
                {
                  kind: "single",
                  value: 45,
                  quality: { pain: false, form: "good", rom: "full" },
                },
              ],
            },
            {
              categoryId: CategoryIdSchema.parse("squat"),
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
            {
              categoryId: CategoryIdSchema.parse("verticalPush"),
              level: 8,
              exerciseName: "프리 HSPU",
              metricRule: { kind: "terminal", label: "상급 목표", laterality: "none" },
              sets: [
                {
                  kind: "single",
                  value: 0,
                  loadKg: 10,
                  quality: { pain: false, form: "good", rom: "full" },
                },
              ],
            },
          ],
        },
        {
          id: terminalSessionId,
          routineId: "B",
          completedAt: "2026-09-02T09:00:00.000Z",
          entries: [
            {
              categoryId: CategoryIdSchema.parse("verticalPush"),
              level: 8,
              exerciseName: "프리 HSPU",
              metricRule: { kind: "terminal", label: "상급 목표", laterality: "none" },
              sets: [],
            },
          ],
        },
      ],
    } satisfies StoredState
    const cards = buildDashboardCards(state)

    expect(cards.find((card) => card.category.id === coreId)?.sameLevelPr).toBe("45초")
    expect(
      cards.find((card) => card.category.id === CategoryIdSchema.parse("squat"))?.sameLevelPr,
    ).toBe("좌 9회 / 우 8회")
    expect(
      cards.find((card) => card.category.id === CategoryIdSchema.parse("verticalPush"))
        ?.sameLevelPr,
    ).toBe("10kg")
  })
})

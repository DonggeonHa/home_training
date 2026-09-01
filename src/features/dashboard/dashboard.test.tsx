import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { DashboardView } from "./DashboardView"

const pushId = CategoryIdSchema.parse("push")
const squatId = CategoryIdSchema.parse("squat")

function populatedState() {
  return {
    ...createCompletedOnboardingState(),
    nextRoutine: "B",
    completedSessions: [
      {
        id: SessionIdSchema.parse("11111111-1111-4111-8111-111111111111"),
        routineId: "A",
        completedAt: "2026-09-01T09:00:00.000Z",
        entries: [
          {
            categoryId: pushId,
            level: 0,
            exerciseName: "벽 푸시업",
            metricRule: { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" },
            sets: [
              { kind: "single", value: 15, quality: { pain: false, form: "good", rom: "full" } },
              { kind: "single", value: 14, quality: { pain: false, form: "good", rom: "full" } },
              { kind: "single", value: 13, quality: { pain: false, form: "good", rom: "full" } },
            ],
          },
          {
            categoryId: squatId,
            level: 0,
            exerciseName: "의자 스쿼트",
            metricRule: { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" },
            sets: [
              { kind: "single", value: 15, quality: { pain: false, form: "good", rom: "full" } },
            ],
          },
        ],
      },
      {
        id: SessionIdSchema.parse("22222222-2222-4222-8222-222222222222"),
        routineId: "B",
        completedAt: "2026-09-03T09:00:00.000Z",
        entries: [
          {
            categoryId: pushId,
            level: 0,
            exerciseName: "벽 푸시업",
            metricRule: { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" },
            sets: [
              { kind: "single", value: 12, quality: { pain: false, form: "good", rom: "full" } },
            ],
          },
        ],
      },
    ],
  } satisfies ReturnType<typeof createCompletedOnboardingState>
}

describe("DashboardView", () => {
  it("renders next manual routine, adaptation progress, and six category cards", () => {
    render(<DashboardView state={populatedState()} startHref="#/record" />)

    expect(screen.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" })).toBeVisible()
    expect(screen.getByText("다음 추천 루틴 B")).toBeVisible()
    expect(screen.getByText("적응기 2 / 6회")).toBeVisible()
    expect(screen.getAllByRole("article", { name: /카테고리 카드/ })).toHaveLength(6)
    expect(screen.getByRole("link", { name: "루틴 B 운동 시작" })).toHaveAttribute(
      "href",
      "#/record",
    )
  })

  it("shows current status, latest record, same-level PR, and remaining condition per card", () => {
    render(<DashboardView state={populatedState()} startHref="#/record" />)

    const pushCard = screen.getByRole("article", { name: "PUSH 카테고리 카드" })

    expect(within(pushCard).getByText("현재 Lv.0")).toBeVisible()
    expect(within(pushCard).getByText("상태: 임시 레벨")).toBeVisible()
    expect(within(pushCard).getByText("현재 운동: 벽 푸시업")).toBeVisible()
    expect(within(pushCard).getByText("다음 운동: Lv.1 높은 인클라인 푸시업")).toBeVisible()
    expect(within(pushCard).getByText("최근 기록: 12회")).toBeVisible()
    expect(within(pushCard).getByText("같은 레벨 PR: 15회")).toBeVisible()
    expect(
      within(pushCard).getByText("남은 조건: 첫 6회 적응기 완료 후 목표 세션 2회"),
    ).toBeVisible()
  })

  it("renders intentional empty history copy without misleading records", () => {
    render(<DashboardView state={createCompletedOnboardingState()} startHref="#/record" />)

    const pullCard = screen.getByRole("article", { name: "PULL 카테고리 카드" })

    expect(within(pullCard).getByText("최근 기록: 아직 없음")).toBeVisible()
    expect(within(pullCard).getByText("같은 레벨 PR: 아직 없음")).toBeVisible()
  })
})

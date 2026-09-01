import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { CategoryIdSchema, SessionIdSchema } from "../../domain/schemas"
import type { StoredState } from "../../storage"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { HistoryView } from "./HistoryView"

const pushId = CategoryIdSchema.parse("push")
const squatId = CategoryIdSchema.parse("squat")
const coreId = CategoryIdSchema.parse("core")

function historyState() {
  const base: StoredState = createCompletedOnboardingState()
  return {
    ...base,
    progress: {
      ...base.progress,
      push: { categoryId: pushId, level: 1, status: "active" },
    },
    completedSessions: [
      {
        id: SessionIdSchema.parse("33333333-3333-4333-8333-333333333333"),
        routineId: "A",
        completedAt: "2026-09-01T09:00:00.000Z",
        entries: [
          {
            categoryId: pushId,
            level: 0,
            exerciseName: "벽 푸시업",
            metricRule: { kind: "reps", min: 15, max: 15, sets: 3, laterality: "none" },
            sets: [
              { kind: "single", value: 10, quality: { pain: false, form: "good", rom: "full" } },
              { kind: "single", value: 12, quality: { pain: false, form: "good", rom: "full" } },
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
                left: 8,
                right: 7,
                quality: { pain: false, form: "good", rom: "full" },
              },
            ],
          },
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
              { kind: "single", value: 45, quality: { pain: false, form: "good", rom: "full" } },
            ],
          },
        ],
      },
      {
        id: SessionIdSchema.parse("44444444-4444-4444-8444-444444444444"),
        routineId: "B",
        completedAt: "2026-09-02T09:00:00.000Z",
        entries: [
          {
            categoryId: pushId,
            level: 1,
            exerciseName: "높은 인클라인 푸시업",
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
        ],
      },
    ],
  } satisfies StoredState
}

describe("HistoryView", () => {
  it("renders an empty recovery state when there are no completed sessions", () => {
    render(<HistoryView state={createCompletedOnboardingState()} />)

    expect(screen.getByRole("heading", { level: 1, name: "기록과 성장" })).toBeVisible()
    expect(screen.getByText("아직 완료된 운동 기록이 없습니다.")).toBeVisible()
  })

  it("filters session history by category and shows latest, PR, and level timeline", async () => {
    render(<HistoryView state={historyState()} />)

    await userEvent.selectOptions(screen.getByLabelText("카테고리 필터"), "push")

    expect(screen.getByText("최근 기록: 15회")).toBeVisible()
    expect(screen.getByText("같은 레벨 PR: 15회")).toBeVisible()
    expect(screen.getByText("레벨 변화: Lv.0, Lv.1")).toBeVisible()
    expect(screen.getByText("높은 인클라인 푸시업")).toBeVisible()
    expect(screen.queryByText("리버스 런지")).not.toBeInTheDocument()
  })

  it("returns to all sessions when the category filter is reset to all", async () => {
    render(<HistoryView state={historyState()} />)

    await userEvent.selectOptions(screen.getByLabelText("카테고리 필터"), "push")
    await userEvent.selectOptions(screen.getByLabelText("카테고리 필터"), "all")

    expect(screen.getByText("높은 인클라인 푸시업")).toBeVisible()
    expect(screen.getByText("리버스 런지")).toBeVisible()
  })

  it("keeps reps, seconds, load, and left/right chart series separate with an equivalent table", async () => {
    render(<HistoryView state={historyState()} />)

    expect(screen.getByRole("img", { name: "반복 기록 그래프" })).toBeVisible()
    expect(screen.getByRole("img", { name: "초 기록 그래프" })).toBeVisible()
    expect(screen.getByRole("img", { name: "중량 기록 그래프" })).toBeVisible()
    expect(screen.getByRole("img", { name: "좌우 반복 기록 그래프" })).toBeVisible()

    const repsTable = screen.getByRole("table", { name: "반복 기록 표" })
    expect(within(repsTable).getByText("10회")).toBeVisible()
    expect(within(repsTable).queryByText("45초")).not.toBeInTheDocument()

    const perSideTable = screen.getByRole("table", { name: "좌우 반복 기록 표" })
    expect(within(perSideTable).getByRole("columnheader", { name: "왼쪽" })).toBeVisible()
    expect(within(perSideTable).getByRole("columnheader", { name: "오른쪽" })).toBeVisible()
    expect(within(perSideTable).getByText("8회")).toBeVisible()
    expect(within(perSideTable).getByText("7회")).toBeVisible()
    expect(screen.queryByText("15회 합산")).not.toBeInTheDocument()
  })

  it("labels categories visibly when the all-category chart combines category entries", () => {
    render(<HistoryView state={historyState()} />)

    const repsPanel = screen
      .getByRole("heading", { level: 2, name: "반복 기록" })
      .closest("section")
    expect(repsPanel).not.toBeNull()
    if (repsPanel === null) {
      return
    }

    expect(within(repsPanel).getByText("카테고리: PUSH")).toBeVisible()
    const repsTable = within(repsPanel).getByRole("table", { name: "반복 기록 표" })
    expect(within(repsTable).getByRole("columnheader", { name: "카테고리" })).toBeVisible()
    expect(within(repsTable).getAllByText("PUSH").length).toBeGreaterThan(0)
  })
})

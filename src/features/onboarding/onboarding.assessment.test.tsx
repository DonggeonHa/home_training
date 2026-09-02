import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HashRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "../../App"
import { CategoryIdSchema } from "../../domain/schemas"
import { APP_STORAGE_KEY } from "../../storage"
import { MemoryStoragePort } from "../../storage/test-ports"
import { AssessmentOnboarding } from "./AssessmentOnboarding"

function renderApp(storage: MemoryStoragePort) {
  window.location.hash = "/"

  return render(
    <HashRouter>
      <App storage={storage} />
    </HashRouter>,
  )
}

describe("assessment onboarding", () => {
  afterEach(() => cleanup())

  it("runs one controlled assessment step with labelled inputs and advances after a pass", async () => {
    const storage = new MemoryStoragePort()
    renderApp(storage)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    await user.click(screen.getByRole("button", { name: "기초 레벨 평가 시작" }))
    const assessment = screen.getByRole("region", { name: "기초 레벨 평가" })
    await user.type(within(assessment).getByRole("spinbutton", { name: "반복 수" }), "15")
    await user.click(within(assessment).getByRole("checkbox", { name: "자세가 안정적입니다" }))
    await user.click(
      within(assessment).getByRole("checkbox", { name: "통증 없는 전체 가동범위입니다" }),
    )
    await user.click(within(assessment).getByRole("button", { name: "평가 세트 저장" }))

    expect(screen.getByRole("heading", { level: 1, name: "PUSH Lv.1" })).toBeVisible()
    expect(storage.values.get(APP_STORAGE_KEY)).not.toContain("자세가 안정적입니다")
  })

  it("resumes the active assessment step after reload", async () => {
    const storage = new MemoryStoragePort()
    const firstRender = renderApp(storage)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "안전 확인 제출" }))
    await user.click(screen.getByRole("button", { name: "기초 레벨 평가 시작" }))
    await user.type(screen.getByRole("spinbutton", { name: "반복 수" }), "15")
    await user.click(screen.getByRole("checkbox", { name: "자세가 안정적입니다" }))
    await user.click(screen.getByRole("checkbox", { name: "통증 없는 전체 가동범위입니다" }))
    await user.click(screen.getByRole("button", { name: "평가 세트 저장" }))
    firstRender.unmount()

    renderApp(storage)

    expect(screen.getByRole("region", { name: "기초 레벨 평가" })).toBeVisible()
    expect(screen.getByText(/Lv\.1/)).toBeVisible()
  })

  it("renders ready, blocked, complete, duration, and per-side assessment states accessibly", async () => {
    const onStart = vi.fn()
    const onSubmitSet = vi.fn()
    const { rerender, container } = render(
      <AssessmentOnboarding
        onStart={onStart}
        onSubmitSet={onSubmitSet}
        step={{ kind: "blocked" }}
      />,
    )

    expect(container).toBeEmptyDOMElement()

    rerender(
      <AssessmentOnboarding onStart={onStart} onSubmitSet={onSubmitSet} step={{ kind: "ready" }} />,
    )
    await userEvent.click(screen.getByRole("button", { name: "기초 레벨 평가 시작" }))
    expect(onStart).toHaveBeenCalledTimes(1)

    rerender(
      <AssessmentOnboarding
        onStart={onStart}
        onSubmitSet={onSubmitSet}
        step={{
          kind: "active",
          categoryId: CategoryIdSchema.parse("pull"),
          categoryTitle: "PULL",
          eligibleLevelCount: 3,
          exerciseName: "Dead hang",
          level: 0,
          metricKind: "single",
          targetLabel: "30초",
        }}
      />,
    )
    await userEvent.type(screen.getByRole("spinbutton", { name: "초" }), "30")
    await userEvent.click(screen.getByRole("checkbox", { name: "자세가 안정적입니다" }))
    await userEvent.click(screen.getByRole("checkbox", { name: "통증 없는 전체 가동범위입니다" }))
    await userEvent.click(screen.getByRole("button", { name: "평가 세트 저장" }))
    expect(onSubmitSet).toHaveBeenLastCalledWith({
      kind: "single",
      value: 30,
      pain: false,
      form: "good",
      rom: "full",
    })

    rerender(
      <AssessmentOnboarding
        onStart={onStart}
        onSubmitSet={onSubmitSet}
        step={{
          kind: "active",
          categoryId: CategoryIdSchema.parse("core"),
          categoryTitle: "CORE",
          eligibleLevelCount: 3,
          exerciseName: "Side plank",
          level: 0,
          metricKind: "perSide",
          targetLabel: "각 10초",
        }}
      />,
    )
    await userEvent.type(screen.getByRole("spinbutton", { name: "왼쪽" }), "10")
    await userEvent.type(screen.getByRole("spinbutton", { name: "오른쪽" }), "12")
    await userEvent.click(
      screen.getByRole("checkbox", { name: "평가 중 통증이나 중단 신호가 있었습니다" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "평가 세트 저장" }))
    expect(onSubmitSet).toHaveBeenLastCalledWith({
      kind: "perSide",
      left: 10,
      right: 12,
      pain: true,
      form: "failed",
      rom: "failed",
    })

    rerender(
      <AssessmentOnboarding
        onStart={onStart}
        onSubmitSet={onSubmitSet}
        step={{ kind: "complete" }}
      />,
    )
    expect(screen.getByRole("heading", { level: 1, name: "기초 레벨 평가 완료" })).toBeVisible()
  })
})

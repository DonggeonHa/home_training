import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HashRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "../../App"
import { CategoryIdSchema } from "../../domain/schemas"
import { APP_STORAGE_KEY } from "../../storage"
import { MemoryStoragePort } from "../../storage/test-ports"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { AssessmentOnboarding } from "./AssessmentOnboarding"
import { SafetyOnboarding } from "./SafetyOnboarding"

function renderApp(storage: MemoryStoragePort) {
  window.location.hash = "/"

  return render(
    <HashRouter>
      <App storage={storage} />
    </HashRouter>,
  )
}

describe("safety onboarding", () => {
  afterEach(() => cleanup())

  it("keeps safety answers transient while the form is edited", async () => {
    const onSubmit = vi.fn()
    render(
      <SafetyOnboarding
        focusFirst={true}
        gate={{ kind: "needsReview" }}
        onReset={vi.fn()}
        onSubmit={onSubmit}
      />,
    )
    const user = userEvent.setup()

    expect(screen.getByRole("checkbox", { name: /현재 흉통/ })).toHaveFocus()
    await user.click(screen.getByRole("checkbox", { name: /현재 흉통/ }))
    await user.click(screen.getByRole("checkbox", { name: /실신했거나/ }))
    await user.click(screen.getByRole("checkbox", { name: /평소와 다른 숨참/ }))
    await user.click(screen.getByRole("checkbox", { name: /심혈관, 대사, 신장/ }))
    await user.click(screen.getByRole("checkbox", { name: /최근 부상/ }))
    await user.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    expect(onSubmit).toHaveBeenCalledWith({
      chestPain: true,
      faintingOrSevereDizziness: true,
      unusualShortnessOfBreath: true,
      cardiovascularMetabolicRenalDisease: true,
      recentInjury: true,
    })
  })

  it("blocks assessment with professional guidance and 119 copy for urgent red flags", async () => {
    const storage = new MemoryStoragePort()
    renderApp(storage)
    const user = userEvent.setup()

    await user.click(screen.getByRole("checkbox", { name: /현재 흉통/ }))
    await user.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    expect(screen.getByText(/의료 진단이나 처방을 제공하지 않습니다/)).toBeVisible()
    expect(screen.getByText(/119/)).toBeVisible()
    expect(screen.queryByRole("button", { name: "기초 레벨 평가 시작" })).not.toBeInTheDocument()
    expect(storage.values.has(APP_STORAGE_KEY)).toBe(false)

    await user.click(screen.getByRole("button", { name: "답변 다시 확인" }))

    expect(screen.getByRole("checkbox", { name: /현재 흉통/ })).toHaveFocus()
  })

  it("persists only the safety clearance timestamp after all answers are clear", async () => {
    const storage = new MemoryStoragePort()
    renderApp(storage)

    await userEvent.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    expect(screen.getByRole("button", { name: "기초 레벨 평가 시작" })).toBeVisible()
    const persisted = storage.values.get(APP_STORAGE_KEY) ?? ""
    expect(persisted).toContain('"safety":{"cleared":true')
    expect(persisted).not.toContain("chestPain")
    expect(persisted).not.toContain("recentInjury")
  })

  it("shows a recoverable save failure notice without claiming persisted success", async () => {
    const storage = new MemoryStoragePort()
    storage.writeError = new DOMException("full", "QuotaExceededError")
    renderApp(storage)

    await userEvent.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    expect(screen.getByRole("heading", { level: 2, name: "저장에 실패했습니다" })).toBeVisible()
    expect(storage.values.has(APP_STORAGE_KEY)).toBe(false)
  })

  it("shows a typed load recovery notice for malformed persisted state", () => {
    const storage = new MemoryStoragePort()
    storage.values.set(APP_STORAGE_KEY, "{bad-json")

    renderApp(storage)

    expect(
      screen.getByRole("heading", { level: 2, name: "저장된 데이터를 복구했습니다" }),
    ).toBeVisible()
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
  })

  it("passes through to the route content only after safety and assessment are complete", async () => {
    const storage = new MemoryStoragePort()
    storage.values.set(APP_STORAGE_KEY, JSON.stringify(createCompletedOnboardingState()))

    renderApp(storage)

    expect(
      await screen.findByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { level: 1, name: "운동 전 안전 확인" }),
    ).not.toBeInTheDocument()
  })

  it("shows non-urgent blocked guidance without emergency copy", async () => {
    const onReset = vi.fn()
    render(
      <SafetyOnboarding
        focusFirst={false}
        gate={{ kind: "blocked", reasons: ["recentInjury"], urgent: false }}
        onReset={onReset}
        onSubmit={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "답변 다시 확인" }))

    expect(screen.getByText(/의료 전문가와 상담하세요/)).toBeVisible()
    expect(screen.queryByText(/119/)).not.toBeInTheDocument()
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})

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

import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HashRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "../../App"
import { CategoryIdSchema } from "../../domain/schemas"
import { APP_STORAGE_KEY } from "../../storage"
import { createDefaultStoredState } from "../../storage/defaults"
import { MemoryStoragePort } from "../../storage/test-ports"
import { AssessmentOnboarding } from "./AssessmentOnboarding"
import { SafetyOnboarding } from "./SafetyOnboarding"

function renderApp(storage: MemoryStoragePort) {
  window.location.hash = "/"

  return render(
    <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App storage={storage} />
    </HashRouter>,
  )
}

describe("safety onboarding", () => {
  afterEach(() => cleanup())

  it("keeps safety answers transient while the form is edited", async () => {
    // Given: the safety form is rendered directly with a submit spy.
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

    // When: every transient checkbox is selected and submitted.
    expect(screen.getByRole("checkbox", { name: /현재 흉통/ })).toHaveFocus()
    await user.click(screen.getByRole("checkbox", { name: /현재 흉통/ }))
    await user.click(screen.getByRole("checkbox", { name: /실신했거나/ }))
    await user.click(screen.getByRole("checkbox", { name: /평소와 다른 숨참/ }))
    await user.click(screen.getByRole("checkbox", { name: /심혈관, 대사, 신장/ }))
    await user.click(screen.getByRole("checkbox", { name: /최근 부상/ }))
    await user.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    // Then: the caller receives the transient answers, not persisted storage.
    expect(onSubmit).toHaveBeenCalledWith({
      chestPain: true,
      faintingOrSevereDizziness: true,
      unusualShortnessOfBreath: true,
      cardiovascularMetabolicRenalDisease: true,
      recentInjury: true,
    })
  })

  it("blocks assessment with professional guidance and 119 copy for urgent red flags", async () => {
    // Given: a new user at the first-run safety form.
    const storage = new MemoryStoragePort()
    renderApp(storage)
    const user = userEvent.setup()

    // When: the current chest-pain answer is selected and submitted.
    await user.click(screen.getByRole("checkbox", { name: /현재 흉통/ }))
    await user.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    // Then: the user sees non-diagnostic blocked guidance with 119 and no assessment start.
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    expect(screen.getByText(/의료 진단이나 처방을 제공하지 않습니다/)).toBeVisible()
    expect(screen.getByText(/119/)).toBeVisible()
    expect(screen.queryByRole("button", { name: "기초 레벨 평가 시작" })).not.toBeInTheDocument()
    expect(storage.values.has(APP_STORAGE_KEY)).toBe(false)

    // When: answers are reviewed and reset.
    await user.click(screen.getByRole("button", { name: "답변 다시 확인" }))

    // Then: focus returns to the transient safety form without a modal trap.
    expect(screen.getByRole("checkbox", { name: /현재 흉통/ })).toHaveFocus()
  })

  it("persists only the safety clearance timestamp after all answers are clear", async () => {
    // Given: a new user at the safety form.
    const storage = new MemoryStoragePort()
    renderApp(storage)

    // When: the clear answers are submitted.
    await userEvent.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    // Then: assessment is offered and storage contains no individual safety answers.
    expect(screen.getByRole("button", { name: "기초 레벨 평가 시작" })).toBeVisible()
    const persisted = storage.values.get(APP_STORAGE_KEY) ?? ""
    expect(persisted).toContain('"safety":{"cleared":true')
    expect(persisted).not.toContain("chestPain")
    expect(persisted).not.toContain("recentInjury")
  })

  it("shows a recoverable save failure notice without claiming persisted success", async () => {
    // Given: browser storage rejects writes.
    const storage = new MemoryStoragePort()
    storage.writeError = new DOMException("full", "QuotaExceededError")
    renderApp(storage)

    // When: safety clearance is submitted.
    await userEvent.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    // Then: the UI exposes the failure and no successful snapshot is present.
    expect(screen.getByRole("heading", { level: 2, name: "저장에 실패했습니다" })).toBeVisible()
    expect(storage.values.has(APP_STORAGE_KEY)).toBe(false)
  })

  it("shows a typed load recovery notice for malformed persisted state", () => {
    // Given: persisted storage is malformed.
    const storage = new MemoryStoragePort()
    storage.values.set(APP_STORAGE_KEY, "{bad-json")

    // When: the app hydrates.
    renderApp(storage)

    // Then: recovery is visible and first-run flow remains safe.
    expect(
      screen.getByRole("heading", { level: 2, name: "저장된 데이터를 복구했습니다" }),
    ).toBeVisible()
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
  })

  it("passes through to the route content only after safety and assessment are complete", () => {
    // Given: stored onboarding requirements are complete.
    const storage = new MemoryStoragePort()
    storage.values.set(
      APP_STORAGE_KEY,
      JSON.stringify({
        ...createDefaultStoredState(),
        safety: { cleared: true, clearedAt: "2026-09-02T00:00:00.000Z" },
        assessment: {
          ...createDefaultStoredState().assessment,
          status: "complete",
          currentCategoryId: null,
        },
      }),
    )

    // When: the app renders the home route.
    renderApp(storage)

    // Then: the normal route is allowed without implementing downstream pages.
    expect(screen.getByRole("heading", { level: 1, name: "홈트레이닝 LEVEL UP" })).toBeVisible()
    expect(
      screen.queryByRole("heading", { level: 1, name: "운동 전 안전 확인" }),
    ).not.toBeInTheDocument()
  })

  it("shows non-urgent blocked guidance without emergency copy", async () => {
    // Given: a non-urgent red flag is already active.
    const onReset = vi.fn()
    render(
      <SafetyOnboarding
        focusFirst={false}
        gate={{ kind: "blocked", reasons: ["recentInjury"], urgent: false }}
        onReset={onReset}
        onSubmit={vi.fn()}
      />,
    )

    // When: the user chooses to review answers.
    await userEvent.click(screen.getByRole("button", { name: "답변 다시 확인" }))

    // Then: professional consultation guidance is shown without urgent 119 copy.
    expect(screen.getByText(/의료 전문가와 상담하세요/)).toBeVisible()
    expect(screen.queryByText(/119/)).not.toBeInTheDocument()
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})

describe("assessment onboarding", () => {
  afterEach(() => cleanup())

  it("runs one controlled assessment step with labelled inputs and advances after a pass", async () => {
    // Given: safety has been cleared.
    const storage = new MemoryStoragePort()
    renderApp(storage)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "안전 확인 제출" }))

    // When: assessment starts and the first PUSH set is submitted.
    await user.click(screen.getByRole("button", { name: "기초 레벨 평가 시작" }))
    const assessment = screen.getByRole("region", { name: "기초 레벨 평가" })
    await user.type(within(assessment).getByRole("spinbutton", { name: "반복 수" }), "15")
    await user.click(within(assessment).getByRole("checkbox", { name: "자세가 안정적입니다" }))
    await user.click(
      within(assessment).getByRole("checkbox", { name: "통증 없는 전체 가동범위입니다" }),
    )
    await user.click(within(assessment).getByRole("button", { name: "평가 세트 저장" }))

    // Then: the same category advances to its next eligible level.
    expect(screen.getByRole("heading", { level: 1, name: "PUSH Lv.1" })).toBeVisible()
    expect(storage.values.get(APP_STORAGE_KEY)).not.toContain("자세가 안정적입니다")
  })

  it("resumes the active assessment step after reload", async () => {
    // Given: one assessment step has been saved.
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

    // When: the app is rendered again from the same storage.
    renderApp(storage)

    // Then: the saved assessment step is restored.
    expect(screen.getByRole("region", { name: "기초 레벨 평가" })).toBeVisible()
    expect(screen.getByText(/Lv\.1/)).toBeVisible()
  })

  it("renders ready, blocked, complete, duration, and per-side assessment states accessibly", async () => {
    // Given: direct assessment component states.
    const onStart = vi.fn()
    const onSubmitSet = vi.fn()
    const { rerender, container } = render(
      <AssessmentOnboarding
        onStart={onStart}
        onSubmitSet={onSubmitSet}
        step={{ kind: "blocked" }}
      />,
    )

    // Then: blocked assessment does not render a bypass.
    expect(container).toBeEmptyDOMElement()

    // When: the ready state starts.
    rerender(
      <AssessmentOnboarding onStart={onStart} onSubmitSet={onSubmitSet} step={{ kind: "ready" }} />,
    )
    await userEvent.click(screen.getByRole("button", { name: "기초 레벨 평가 시작" }))
    expect(onStart).toHaveBeenCalledTimes(1)

    // When: a duration-based active state is submitted.
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

    // When: a per-side active state is submitted with pain selected.
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

    // Then: completion explains the allowed next route.
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

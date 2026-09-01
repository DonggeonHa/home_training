import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { WorkoutSessionPage } from "./WorkoutSessionPage"

const nowMs = Date.parse("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("55555555-5555-4555-8555-555555555555")

describe("WorkoutSessionPage", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("renders warmups, opens a keyboard reachable set form, and emits active patches", async () => {
    const onActiveSessionChange = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <WorkoutSessionPage
        nowMs={nowMs}
        onActiveSessionChange={onActiveSessionChange}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )

    expect(screen.getByRole("heading", { level: 1, name: /Routine A/ })).toBeVisible()
    expect(screen.getByRole("list", { name: "공통 워밍업" })).toBeVisible()

    await user.tab()
    expect(screen.getByRole("button", { name: "공통 워밍업 완료" })).toHaveFocus()
    await user.keyboard("{Enter}")
    await user.click(screen.getByRole("button", { name: "카테고리 워밍업 완료" }))
    await user.click(screen.getByRole("button", { name: "세트 기록" }))
    await user.type(screen.getByRole("spinbutton", { name: "반복 수" }), "15")
    await user.click(screen.getByRole("button", { name: "세트 저장" }))

    expect(screen.getByText("01:30")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "-30초" }))
    rerender(
      <WorkoutSessionPage
        nowMs={nowMs + 31_000}
        onActiveSessionChange={onActiveSessionChange}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )
    expect(screen.getByText("30초 남았습니다")).toBeInTheDocument()
    expect(onActiveSessionChange).toHaveBeenCalled()
  })

  it("updates injected-time rest countdown and live announcement from the same timestamp", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <WorkoutSessionPage
        nowMs={nowMs}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "공통 워밍업 완료" }))
    await user.click(screen.getByRole("button", { name: "세트 기록" }))
    await user.type(screen.getByRole("spinbutton", { name: "반복 수" }), "15")
    await user.click(screen.getByRole("button", { name: "세트 저장" }))
    rerender(
      <WorkoutSessionPage
        nowMs={nowMs + 60_000}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )

    expect(screen.getByText("00:30")).toBeVisible()
    expect(screen.getByText("30초 남았습니다")).toBeInTheDocument()
  })

  it("ticks production rest countdown without writing active-session snapshots every second", () => {
    vi.useFakeTimers()
    vi.setSystemTime(nowMs)
    const onActiveSessionChange = vi.fn()

    render(
      <WorkoutSessionPage
        onActiveSessionChange={onActiveSessionChange}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "공통 워밍업 완료" }))
    fireEvent.click(screen.getByRole("button", { name: "세트 기록" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "반복 수" }), {
      target: { value: "15" },
    })
    fireEvent.click(screen.getByRole("button", { name: "세트 저장" }))
    const callsAfterRestStarts = onActiveSessionChange.mock.calls.length
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(59_000))

    expect(screen.getByText("00:31")).toBeVisible()
    expect(onActiveSessionChange).toHaveBeenCalledTimes(callsAfterRestStarts)

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText("00:30")).toBeVisible()
    expect(screen.getByText("30초 남았습니다")).toBeInTheDocument()
    expect(onActiveSessionChange).toHaveBeenCalledTimes(callsAfterRestStarts + 1)

    act(() => vi.advanceTimersByTime(20_000))
    expect(screen.getByText("00:10")).toBeVisible()
    expect(screen.getByText("10초 남았습니다")).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByRole("heading", { level: 2, name: "휴식" })).not.toBeInTheDocument()
    expect(screen.getByText("0초 남았습니다")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: /Routine A · SQUAT/ })).toBeVisible()
    expect(vi.getTimerCount()).toBe(0)
    const callsAfterRestEnds = onActiveSessionChange.mock.calls.length

    act(() => vi.advanceTimersByTime(5_000))

    expect(onActiveSessionChange).toHaveBeenCalledTimes(callsAfterRestEnds)
  })

  it("cleans up the production rest interval on unmount", () => {
    vi.useFakeTimers()
    vi.setSystemTime(nowMs)

    const { unmount } = render(
      <WorkoutSessionPage sessionId={sessionId} stored={createCompletedOnboardingState()} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "공통 워밍업 완료" }))
    fireEvent.click(screen.getByRole("button", { name: "세트 기록" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "반복 수" }), {
      target: { value: "15" },
    })
    fireEvent.click(screen.getByRole("button", { name: "세트 저장" }))
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it("persists category-specific warmup completion from the page", async () => {
    const onActiveSessionChange = vi.fn()
    const user = userEvent.setup()

    render(
      <WorkoutSessionPage
        nowMs={nowMs}
        onActiveSessionChange={onActiveSessionChange}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "카테고리 워밍업 완료" }))

    expect(onActiveSessionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workout: expect.objectContaining({
          categoryWarmupCompleteByCategory: expect.objectContaining({ squat: true }),
        }),
      }),
    )
  })

  it("emits active-session patches exactly once for each persisted draft and set state", async () => {
    const onActiveSessionChange = vi.fn()
    const user = userEvent.setup()

    render(
      <WorkoutSessionPage
        nowMs={nowMs}
        onActiveSessionChange={onActiveSessionChange}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "공통 워밍업 완료" }))
    await user.click(screen.getByRole("button", { name: "세트 기록" }))
    await user.type(screen.getByRole("spinbutton", { name: "반복 수" }), "15")
    expect(onActiveSessionChange).toHaveBeenCalledTimes(4)
    expect(onActiveSessionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workout: expect.objectContaining({
          phase: "setEntry",
          setDraft: expect.objectContaining({ kind: "single", valueText: "15" }),
        }),
      }),
    )

    await user.click(screen.getByRole("button", { name: "세트 저장" }))
    expect(onActiveSessionChange).toHaveBeenCalledTimes(5)
  })

  it("shows pull checklist before pull set entry", async () => {
    const user = userEvent.setup()

    render(
      <WorkoutSessionPage
        nowMs={nowMs}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )

    await stopCurrentCategoryByPain(user, "반복 수", "15")
    await stopCurrentCategoryByPain(user, "반복 수", "10")

    const checklist = screen.getByRole("group", { name: "철봉 안전 확인" })
    expect(within(checklist).getAllByRole("checkbox")).toHaveLength(4)

    await user.click(screen.getByRole("button", { name: "세트 기록" }))
    expect(screen.getByText(/철봉 설치와 흔들림 확인/)).toBeVisible()
    for (const checkbox of within(checklist).getAllByRole("checkbox")) {
      await user.click(checkbox)
    }
    await user.click(screen.getByRole("button", { name: "세트 기록" }))
    expect(screen.getByRole("spinbutton", { name: "초" })).toBeVisible()
  })

  it("requires explicit abandon confirmation without calling completion", async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()

    render(
      <WorkoutSessionPage
        nowMs={nowMs}
        onComplete={onComplete}
        sessionId={sessionId}
        stored={createCompletedOnboardingState()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "세션 포기" }))
    expect(screen.getByRole("dialog", { name: "세션을 포기할까요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "포기 확정" }))

    expect(screen.getByRole("heading", { level: 1, name: "세션이 중단되었습니다" })).toBeVisible()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("renders with default time and disables the painful exercise after a stop signal", async () => {
    const user = userEvent.setup()

    render(<WorkoutSessionPage sessionId={sessionId} stored={createCompletedOnboardingState()} />)

    await user.click(screen.getByRole("button", { name: "공통 워밍업 완료" }))
    await user.click(screen.getByRole("button", { name: "세트 기록" }))
    await user.type(screen.getByRole("spinbutton", { name: "반복 수" }), "15")
    await user.click(screen.getByRole("checkbox", { name: /통증/ }))
    await user.click(screen.getByRole("button", { name: "세트 저장" }))

    expect(screen.getByText(/119/)).toBeVisible()
    expect(screen.getByRole("button", { name: "세트 기록" })).toBeDisabled()
  })
})

async function stopCurrentCategoryByPain(
  user: ReturnType<typeof userEvent.setup>,
  inputName: string,
  value: string,
) {
  const commonWarmup = screen.queryByRole("button", { name: "공통 워밍업 완료" })
  if (commonWarmup !== null && !commonWarmup.hasAttribute("disabled")) {
    await user.click(commonWarmup)
  }
  const categoryWarmup = screen.queryByRole("button", { name: "카테고리 워밍업 완료" })
  if (categoryWarmup !== null && !categoryWarmup.hasAttribute("disabled")) {
    await user.click(categoryWarmup)
  }
  await user.click(screen.getByRole("button", { name: "세트 기록" }))
  await user.type(screen.getByRole("spinbutton", { name: inputName }), value)
  await user.click(screen.getByRole("checkbox", { name: /통증/ }))
  await user.click(screen.getByRole("button", { name: "세트 저장" }))
  await user.click(screen.getByRole("button", { name: "다음 카테고리" }))
}

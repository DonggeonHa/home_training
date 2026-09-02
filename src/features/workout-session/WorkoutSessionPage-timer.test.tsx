import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { WorkoutSessionPage } from "./WorkoutSessionPage"

const nowMs = Date.parse("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("55555555-5555-4555-8555-555555555555")

describe("WorkoutSessionPage rest timer", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
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
})

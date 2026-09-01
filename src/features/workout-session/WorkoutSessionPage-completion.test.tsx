import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SessionIdSchema } from "../../domain/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { WorkoutSessionPage } from "./WorkoutSessionPage"

const nowMs = Date.parse("2026-09-02T00:00:00.000Z")
const sessionId = SessionIdSchema.parse("55555555-5555-4555-8555-555555555555")

describe("WorkoutSessionPage completion controls", () => {
  afterEach(() => cleanup())

  it("disables category advance with remaining-set copy until prerequisites are complete", async () => {
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

    expect(screen.getByRole("button", { name: "공통 워밍업 필요" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "공통 워밍업 완료" }))
    await user.click(screen.getByRole("button", { name: "카테고리 워밍업 완료" }))
    expect(screen.getByRole("button", { name: /2세트 남음/ })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "세트 기록" }))
    await user.type(screen.getByRole("spinbutton", { name: "반복 수" }), "15")
    await user.click(screen.getByRole("button", { name: "세트 저장" }))

    expect(screen.getByRole("button", { name: /1세트 남음/ })).toBeDisabled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("emits one completion patch after every category is completed or pain-stopped", async () => {
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

    await stopCurrentCategoryByPain(user, "반복 수", "15")
    await stopCurrentCategoryByPain(user, "반복 수", "10")
    await confirmPullChecklist(user)
    await stopCurrentCategoryByPain(user, "초", "30")
    await stopCurrentCategoryByPain(user, "초", "45")

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ activeSession: null, nextRoutine: "B" }),
    )
    expect(onComplete).toHaveBeenCalledTimes(1)
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

async function confirmPullChecklist(user: ReturnType<typeof userEvent.setup>) {
  const checklist = screen.getByRole("group", { name: "철봉 안전 확인" })
  for (const checkbox of within(checklist).getAllByRole("checkbox")) {
    await user.click(checkbox)
  }
}

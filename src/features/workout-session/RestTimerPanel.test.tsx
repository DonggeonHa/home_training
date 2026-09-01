import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RestTimerPanel } from "./RestTimerPanel"

describe("RestTimerPanel", () => {
  afterEach(() => cleanup())

  it("emits rest control actions when the timer is visible", async () => {
    const onDispatch = vi.fn()
    const user = userEvent.setup()

    render(<RestTimerPanel lastAnnouncement="30" remainingSeconds={90} onDispatch={onDispatch} />)

    expect(screen.getByText("01:30")).toBeVisible()
    expect(screen.getByText("30초 남았습니다")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "-30초" }))
    await user.click(screen.getByRole("button", { name: "+30초" }))
    await user.click(screen.getByRole("button", { name: "Skip" }))

    expect(onDispatch).toHaveBeenNthCalledWith(1, { deltaSeconds: -30, type: "restAdjusted" })
    expect(onDispatch).toHaveBeenNthCalledWith(2, { deltaSeconds: 30, type: "restAdjusted" })
    expect(onDispatch).toHaveBeenNthCalledWith(3, { type: "restSkipped" })
  })
})

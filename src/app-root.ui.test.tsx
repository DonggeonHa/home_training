import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Button, Dialog, Field, Progress } from "./shared/ui"

const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

describe("UI primitives", () => {
  afterEach(() => {
    cleanup()
    HTMLDialogElement.prototype.showModal = originalShowModal
    HTMLDialogElement.prototype.close = originalClose
  })

  it("returns focus to the opener when the dialog closes by keyboard", async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "")
    })
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.removeAttribute("open")
    })

    function DialogHarness() {
      const [open, setOpen] = useState(false)

      return (
        <>
          <Button onClick={() => setOpen(true)}>설명 열기</Button>
          <Dialog onOpenChange={setOpen} open={open} title="운동 안내" triggerLabel="설명 열기">
            <p>통증이 있으면 운동을 멈추세요.</p>
          </Dialog>
        </>
      )
    }

    render(<DialogHarness />)

    await userEvent.click(screen.getByRole("button", { name: "설명 열기" }))
    expect(screen.getByRole("dialog", { name: "운동 안내" })).toBeVisible()
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus()
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "운동 안내" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "설명 열기" })).toHaveFocus()
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce()
  })

  it("connects field labels, descriptions, and errors without placeholder labels", () => {
    render(
      <Field
        error="2자 이상 입력하세요."
        hint="운동 기록에 표시됩니다."
        id="routine-name"
        label="루틴 이름"
      >
        <input id="routine-name" type="text" />
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "루틴 이름" })
    expect(input).toHaveAccessibleDescription("운동 기록에 표시됩니다. 2자 이상 입력하세요.")
    expect(input).toHaveAttribute("aria-invalid", "true")
  })

  it("renders progress with accessible value semantics and visible label text", () => {
    render(<Progress label="이번 주 진행률" max={12} value={5} />)

    const progress = screen.getByRole("progressbar", { name: "이번 주 진행률" })
    expect(progress).toHaveAttribute("aria-valuemin", "0")
    expect(progress).toHaveAttribute("aria-valuemax", "12")
    expect(progress).toHaveAttribute("aria-valuenow", "5")
    expect(screen.getByText("5 / 12")).toBeVisible()
  })
})

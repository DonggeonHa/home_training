import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AbandonDialog, PullChecklist, uniqueItems, WarmupList } from "./SessionSections"

describe("SessionSections", () => {
  afterEach(() => cleanup())

  it("renders incomplete and complete warmup states", () => {
    const { rerender } = render(<WarmupList complete={false} />)
    expect(screen.getByText("제자리 걷기 60초")).toBeVisible()

    rerender(<WarmupList complete={true} />)
    expect(screen.getByText("완료 · 제자리 걷기 60초")).toBeVisible()
  })

  it("confirms pull checklist only when every item is checked", async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PullChecklist confirmed={false} items={["설치", "하중"]} onConfirm={onConfirm} />)

    await user.click(screen.getByRole("checkbox", { name: "설치" }))
    await user.click(screen.getByRole("checkbox", { name: "설치" }))
    await user.click(screen.getByRole("checkbox", { name: "설치" }))
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole("checkbox", { name: "하중" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("handles abandon dialog cancel and confirm actions", async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <AbandonDialog open={false} onCancel={onCancel} onConfirm={onConfirm} />,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    rerender(<AbandonDialog open={true} onCancel={onCancel} onConfirm={onConfirm} />)
    await user.click(screen.getByRole("button", { name: "계속하기" }))
    await user.click(screen.getByRole("button", { name: "포기 확정" }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("opens with an attribute fallback when native showModal is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: undefined,
    })

    try {
      render(<AbandonDialog open={true} onCancel={vi.fn()} onConfirm={vi.fn()} />)

      expect(screen.getByRole("dialog", { name: "세션을 포기할까요?" })).toHaveAttribute("open")
    } finally {
      if (descriptor === undefined) {
        Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
      } else {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", descriptor)
      }
    }
  })

  it("removes the open attribute when fallback dialogs close without native close", () => {
    const showModalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    )
    const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: undefined,
    })

    try {
      const { rerender } = render(
        <AbandonDialog open={true} onCancel={vi.fn()} onConfirm={vi.fn()} />,
      )
      const dialog = screen.getByRole("dialog", { name: "세션을 포기할까요?" })
      expect(dialog).toHaveAttribute("open")

      rerender(<AbandonDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
      expect(dialog).not.toHaveAttribute("open")
    } finally {
      restorePrototypeMethod("showModal", showModalDescriptor)
      restorePrototypeMethod("close", closeDescriptor)
    }
  })

  it("moves focus into the dialog and restores it on cancel", async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const opener = screen.getByRole("button", { name: "포기 열기" })
    opener.focus()
    await user.click(opener)

    expect(screen.getByRole("button", { name: "포기 확정" })).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "계속하기" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it("routes native cancel events through the cancel callback", () => {
    const onCancel = vi.fn()
    render(<AbandonDialog open={true} onCancel={onCancel} onConfirm={vi.fn()} />)

    fireEvent(screen.getByRole("dialog", { name: "세션을 포기할까요?" }), new Event("cancel"))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("closes an open native dialog on unmount", () => {
    const showModalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    )
    const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
    const close = vi.fn(function closeDialog(this: HTMLDialogElement) {
      this.removeAttribute("open")
    })
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function showModal(this: HTMLDialogElement) {
        this.setAttribute("open", "")
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close,
    })

    try {
      const { unmount } = render(
        <AbandonDialog open={true} onCancel={vi.fn()} onConfirm={vi.fn()} />,
      )
      unmount()

      expect(close).toHaveBeenCalledTimes(1)
    } finally {
      restorePrototypeMethod("showModal", showModalDescriptor)
      restorePrototypeMethod("close", closeDescriptor)
    }
  })

  it("does not restore focus again when an already closed dialog unmounts", () => {
    const showModalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    )
    const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function showModal(this: HTMLDialogElement) {
        this.setAttribute("open", "")
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function closeDialog(this: HTMLDialogElement) {
        this.removeAttribute("open")
      },
    })

    try {
      const opener = document.createElement("button")
      document.body.append(opener)
      opener.focus()
      const focus = vi.spyOn(opener, "focus")
      const { rerender, unmount } = render(
        <AbandonDialog open={true} onCancel={vi.fn()} onConfirm={vi.fn()} />,
      )

      rerender(<AbandonDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
      unmount()

      expect(focus).toHaveBeenCalledTimes(1)
      opener.remove()
    } finally {
      restorePrototypeMethod("showModal", showModalDescriptor)
      restorePrototypeMethod("close", closeDescriptor)
    }
  })

  it("does not restore focus to a disconnected opener when an open dialog unmounts", () => {
    const showModalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    )
    const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function showModal(this: HTMLDialogElement) {
        this.setAttribute("open", "")
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function closeDialog(this: HTMLDialogElement) {
        this.removeAttribute("open")
      },
    })

    try {
      const opener = document.createElement("button")
      document.body.append(opener)
      opener.focus()
      const focus = vi.spyOn(opener, "focus")
      const { unmount } = render(
        <AbandonDialog open={true} onCancel={vi.fn()} onConfirm={vi.fn()} />,
      )

      opener.remove()
      unmount()

      expect(focus).not.toHaveBeenCalled()
    } finally {
      restorePrototypeMethod("showModal", showModalDescriptor)
      restorePrototypeMethod("close", closeDescriptor)
    }
  })

  it("deduplicates rendered guidance items", () => {
    expect(uniqueItems(["흉통", "흉통", "저림"])).toEqual(["흉통", "저림"])
  })
})

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        포기 열기
      </button>
      <AbandonDialog open={open} onCancel={() => setOpen(false)} onConfirm={vi.fn()} />
    </>
  )
}

function restorePrototypeMethod(
  method: "close" | "showModal",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor === undefined) {
    Reflect.deleteProperty(HTMLDialogElement.prototype, method)
    return
  }
  Object.defineProperty(HTMLDialogElement.prototype, method, descriptor)
}

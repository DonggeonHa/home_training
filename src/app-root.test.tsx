import { readFileSync } from "node:fs"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { HashRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"
import { resolveMotionClass, resolveThemePreference, storeThemePreference } from "./app/theme"
import { Button, Dialog, Field, Progress } from "./shared/ui"
import { APP_STORAGE_KEY } from "./storage"
import { MemoryStoragePort } from "./storage/test-ports"
import { createCompletedOnboardingState } from "./test/onboarding-fixtures"

const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

function createCompletedOnboardingStorage() {
  const storage = new MemoryStoragePort()
  storage.values.set(APP_STORAGE_KEY, JSON.stringify(createCompletedOnboardingState()))
  return storage
}

function renderAppAtHash(path: string, storage = new MemoryStoragePort()) {
  window.location.hash = path

  return render(
    <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App storage={storage} />
    </HashRouter>,
  )
}

describe("App root", () => {
  afterEach(() => {
    cleanup()
    HTMLDialogElement.prototype.showModal = originalShowModal
    HTMLDialogElement.prototype.close = originalClose
  })

  it("renders the first-run safety gate when the home route starts", () => {
    renderAppAtHash("/")

    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
  })

  it("exposes a skip link, banner, navigation, and main landmark", async () => {
    renderAppAtHash("/")

    const skipLink = screen.getByRole("link", { name: "본문으로 건너뛰기" })
    await userEvent.tab()

    expect(skipLink).toHaveFocus()
    expect(skipLink).toHaveAttribute("href", "#main-content")
    expect(screen.getByRole("banner")).toBeVisible()
    expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible()
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content")
  })

  it("opens the safety principles dialog from the shell and restores trigger focus", async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "")
    })
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.removeAttribute("open")
    })

    renderAppAtHash("/")

    const user = userEvent.setup()
    const trigger = screen.getByRole("button", { name: "안전 원칙" })

    await user.click(trigger)

    expect(screen.getByRole("dialog", { name: "안전 원칙" })).toBeVisible()
    expect(screen.getByText("통증이 있으면 즉시 중단합니다.")).toBeVisible()

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog", { name: "안전 원칙" })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce()
  })

  it("focuses the main landmark when the skip link activates", async () => {
    renderAppAtHash("/")

    const user = userEvent.setup()
    const skipLink = screen.getByRole("link", { name: "본문으로 건너뛰기" })
    const main = screen.getByRole("main")
    const originalHash = window.location.hash

    await user.click(skipLink)

    expect(main).toHaveAttribute("tabindex", "-1")
    expect(main).toHaveFocus()
    expect(window.location.hash).toBe(originalHash)
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
  })

  it("keeps every normal route behind the global first-run onboarding gate", () => {
    renderAppAtHash("/record")

    const nav = screen.getByRole("navigation", { name: "주요 메뉴" })
    expect(within(nav).getByRole("link", { name: "기록" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    expect(screen.queryByRole("heading", { level: 1, name: "기록" })).not.toBeInTheDocument()

    cleanup()
    renderAppAtHash("/unsupported")
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    expect(
      screen.queryByRole("heading", { level: 1, name: "페이지를 찾을 수 없습니다" }),
    ).not.toBeInTheDocument()
  })

  it("renders selected routes and unknown hashes after onboarding is complete", () => {
    renderAppAtHash("/record", createCompletedOnboardingStorage())

    const nav = screen.getByRole("navigation", { name: "주요 메뉴" })
    expect(within(nav).getByRole("link", { name: "기록" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("heading", { level: 1, name: "기록" })).toBeVisible()

    cleanup()
    renderAppAtHash("/unsupported", createCompletedOnboardingStorage())
    expect(
      screen.getByRole("heading", { level: 1, name: "페이지를 찾을 수 없습니다" }),
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "#/")
  })
})

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

describe("theme and motion helpers", () => {
  it("resolves system, light, and dark theme preferences", () => {
    expect(resolveThemePreference("system", true)).toBe("dark")
    expect(resolveThemePreference("system", false)).toBe("light")
    expect(resolveThemePreference("light", true)).toBe("light")
    expect(resolveThemePreference("dark", false)).toBe("dark")
  })

  it("persists only supported theme preferences", () => {
    const storage = {
      setItem: vi.fn(),
    } satisfies Pick<Storage, "setItem">

    storeThemePreference(storage, "dark")

    expect(storage.setItem).toHaveBeenCalledWith("home-training-theme", "dark")
  })

  it("maps reduced motion preference to stable class names", () => {
    expect(resolveMotionClass(true)).toBe("motion-reduce")
    expect(resolveMotionClass(false)).toBe("motion-ok")
  })
})

describe("design token accessibility", () => {
  const tokenCss = readFileSync("src/styles/tokens.css", "utf8")
  const lightTokens = {
    accentInk: readToken("accent-ink"),
    accentPrimary: readToken("accent-primary"),
    surfaceSecondary: readToken("surface-secondary"),
    statusWarning: readToken("status-warning"),
    surfaceElevated: readToken("surface-elevated"),
  } as const

  function readToken(name: string) {
    const value = tokenCss.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`))?.at(1)
    expect(value).toBeDefined()

    return value ?? ""
  }

  function contrastRatio(foreground: string, background: string) {
    const foregroundLuminance = relativeLuminance(foreground)
    const backgroundLuminance = relativeLuminance(background)
    const lighter = Math.max(foregroundLuminance, backgroundLuminance)
    const darker = Math.min(foregroundLuminance, backgroundLuminance)

    return (lighter + 0.05) / (darker + 0.05)
  }

  function relativeLuminance(color: string) {
    const red = Number.parseInt(color.slice(1, 3), 16) / 255
    const green = Number.parseInt(color.slice(3, 5), 16) / 255
    const blue = Number.parseInt(color.slice(5, 7), 16) / 255
    const linearRed = linearize(red)
    const linearGreen = linearize(green)
    const linearBlue = linearize(blue)

    return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
  }

  function linearize(channel: number) {
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }

  it("keeps light theme warning, active nav, and primary button contrast at AA", () => {
    expect(
      contrastRatio(lightTokens.statusWarning, lightTokens.surfaceElevated),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(lightTokens.accentPrimary, lightTokens.surfaceSecondary),
    ).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(lightTokens.accentInk, lightTokens.accentPrimary)).toBeGreaterThanOrEqual(
      4.5,
    )
  })
})

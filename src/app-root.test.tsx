import { cleanup, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"
import { APP_STORAGE_KEY } from "./storage"
import { MemoryStoragePort } from "./storage/test-ports"
import { createCompletedOnboardingState } from "./test/onboarding-fixtures"
import { renderInStaticShell } from "./test/static-shell"

const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

function createCompletedOnboardingStorage() {
  const storage = new MemoryStoragePort()
  storage.values.set(APP_STORAGE_KEY, JSON.stringify(createCompletedOnboardingState()))
  return storage
}

function renderAppAtHash(path: string, storage = new MemoryStoragePort()) {
  window.location.hash = path

  return renderInStaticShell(<App storage={storage} />)
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
    const main = screen.getByRole("main")
    await userEvent.tab()

    expect(skipLink).toHaveFocus()
    expect(skipLink).toHaveAttribute("href", "#main-content")
    expect(screen.getByRole("banner")).toBeVisible()
    expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible()
    expect(main).toHaveAttribute("id", "main-content")
    expect(main).toHaveClass("app-main")
    expect(main).toHaveAttribute("tabindex", "0")
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

  it("focuses the keyboard-scrollable main landmark when the skip link activates", async () => {
    renderAppAtHash("/")

    const user = userEvent.setup()
    const skipLink = screen.getByRole("link", { name: "본문으로 건너뛰기" })
    const main = screen.getByRole("main")
    const originalHash = window.location.hash

    await user.click(skipLink)

    expect(skipLink).toHaveAttribute("href", "#main-content")
    expect(main).toHaveClass("app-main")
    expect(main).toHaveAttribute("tabindex", "0")
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

  it("renders selected routes and unknown hashes after onboarding is complete", async () => {
    renderAppAtHash("/record", createCompletedOnboardingStorage())

    const nav = screen.getByRole("navigation", { name: "주요 메뉴" })
    expect(within(nav).getByRole("link", { name: "기록" })).toHaveAttribute("aria-current", "page")
    expect(await screen.findByRole("heading", { level: 1, name: "기록과 성장" })).toBeVisible()

    cleanup()
    renderAppAtHash("/unsupported", createCompletedOnboardingStorage())
    expect(
      await screen.findByRole("heading", { level: 1, name: "페이지를 찾을 수 없습니다" }),
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "#/")
  })
})

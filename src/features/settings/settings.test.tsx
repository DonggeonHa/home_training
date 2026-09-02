import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { StoredState } from "../../storage"
import { exportStoredState } from "../../storage"
import { StoredStateSchema } from "../../storage/schemas"
import { MemoryDownloadPort } from "../../storage/test-ports"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { type SettingsRestoreCommitResult, SettingsView } from "./SettingsView"

function fileWithContent(content: string, name = "backup.json") {
  return new File([content], name, { type: "application/json" })
}

describe("SettingsView", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders theme and reduced-motion controls through injected settings actions", async () => {
    const onThemeChange = vi.fn()
    const onReducedMotionChange = vi.fn()

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new MemoryDownloadPort()}
        onReducedMotionChange={onReducedMotionChange}
        onRestoreConfirmed={() => ({ kind: "saved" })}
        onThemeChange={onThemeChange}
        reducedMotion="system"
        theme="system"
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText("테마"), "dark")
    await userEvent.click(screen.getByRole("checkbox", { name: "움직임 줄이기" }))

    expect(onThemeChange).toHaveBeenCalledWith("dark")
    expect(onReducedMotionChange).toHaveBeenCalledWith("reduce")

    fireEvent.change(screen.getByLabelText("테마"), { target: { value: "unsupported" } })
    expect(onThemeChange).toHaveBeenLastCalledWith("system")
  })

  it("sends system when a reduced-motion checkbox is turned off", async () => {
    const onReducedMotionChange = vi.fn()

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new MemoryDownloadPort()}
        onReducedMotionChange={onReducedMotionChange}
        onRestoreConfirmed={() => ({ kind: "saved" })}
        onThemeChange={() => undefined}
        reducedMotion="reduce"
        theme="system"
      />,
    )

    await userEvent.click(screen.getByRole("checkbox", { name: "움직임 줄이기" }))
    expect(onReducedMotionChange).toHaveBeenLastCalledWith("system")
  })

  it("exports the current state as JSON", async () => {
    const downloads = new MemoryDownloadPort()

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={downloads}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={() => ({ kind: "saved" })}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "JSON 백업 내보내기" }))

    expect(downloads.downloads).toHaveLength(1)
    expect(downloads.downloads[0]?.fileName).toBe("home-training-level-up-backup.json")
    expect(StoredStateSchema.parse(JSON.parse(downloads.downloads[0]?.content ?? "{}"))).toEqual(
      createCompletedOnboardingState(),
    )
  })

  it("preserves current state and reports validation errors for malformed and oversized imports without restore calls", async () => {
    const onRestoreConfirmed = vi.fn<(state: StoredState) => SettingsRestoreCommitResult>()

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new MemoryDownloadPort()}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={onRestoreConfirmed}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )

    const fileInput = screen.getByLabelText("백업 파일 선택")
    await userEvent.upload(fileInput, fileWithContent("{"))
    expect(await screen.findByText("가져오기 파일을 읽을 수 없습니다.")).toBeVisible()
    expect(fileInput).toHaveFocus()

    const oversized = fileWithContent("x".repeat(2 * 1024 * 1024 + 1), "large.json")
    await userEvent.upload(fileInput, oversized)
    expect(await screen.findByText("2MiB 이하 JSON 파일만 가져올 수 있습니다.")).toBeVisible()
    expect(onRestoreConfirmed).not.toHaveBeenCalled()
  })

  it("ignores an empty file picker change without showing an import notice", () => {
    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new MemoryDownloadPort()}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={() => ({ kind: "saved" })}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )

    fireEvent.change(screen.getByLabelText("백업 파일 선택"), {
      target: {
        files: {
          item: () => null,
          length: 0,
        },
      },
    })

    expect(screen.queryByText("가져오기 파일을 읽을 수 없습니다.")).not.toBeInTheDocument()
    expect(screen.queryByText("복원 미리보기", { exact: false })).not.toBeInTheDocument()
  })

  it("previews a valid backup through the modern File.text path", async () => {
    const backupJson = exportStoredState(createCompletedOnboardingState())
    const file = fileWithContent("", "modern-backup.json")
    Object.defineProperty(file, "text", {
      configurable: true,
      value: () => Promise.resolve(backupJson),
    })

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new MemoryDownloadPort()}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={() => ({ kind: "saved" })}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )

    await userEvent.upload(screen.getByLabelText("백업 파일 선택"), file)

    expect(await screen.findByText("복원 미리보기: 기록 0개")).toBeVisible()
  })

  it("reports file reader errors without previewing stale restore data", async () => {
    class ErrorFileReader {
      error: DOMException | null = null
      result: string | ArrayBuffer | null = null
      private readonly listeners = new Map<string, EventListenerOrEventListenerObject>()

      addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        this.listeners.set(type, listener)
      }

      readAsText(_file: File): void {
        const listener = this.listeners.get("error")
        const event = new Event("error")
        if (typeof listener === "function") {
          listener(event)
          return
        }
        listener?.handleEvent(event)
      }
    }

    vi.stubGlobal("FileReader", ErrorFileReader)

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new MemoryDownloadPort()}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={() => ({ kind: "saved" })}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )

    const file = fileWithContent("{}")
    Object.defineProperty(file, "text", {
      configurable: true,
      value: undefined,
    })

    await userEvent.upload(screen.getByLabelText("백업 파일 선택"), file)

    expect(await screen.findByText("가져오기 파일을 읽을 수 없습니다.")).toBeVisible()
    expect(screen.queryByLabelText("복원 미리보기")).not.toBeInTheDocument()
  })
})

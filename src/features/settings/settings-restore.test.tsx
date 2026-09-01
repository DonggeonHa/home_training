import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { StoredState } from "../../storage"
import { exportStoredState } from "../../storage"
import { FailingDownloadPort, MemoryDownloadPort } from "../../storage/test-ports"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { type SettingsRestoreCommitResult, SettingsView } from "./SettingsView"

function fileWithContent(content: string, name = "backup.json") {
  return new File([content], name, { type: "application/json" })
}

describe("SettingsView restore flow", () => {
  it("previews restore counts and only reports success after async save confirmation with backup first", async () => {
    const downloads = new MemoryDownloadPort()
    const onRestoreConfirmed = vi.fn<(state: StoredState) => Promise<SettingsRestoreCommitResult>>()
    const restoredState = {
      ...createCompletedOnboardingState(),
      completedSessions: [],
    }
    onRestoreConfirmed.mockResolvedValue({ kind: "saved" })

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={downloads}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={onRestoreConfirmed}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )

    await userEvent.upload(
      screen.getByLabelText("백업 파일 선택"),
      fileWithContent(exportStoredState(restoredState)),
    )
    expect(await screen.findByText("복원 미리보기: 기록 0개")).toBeVisible()
    expect(screen.getByText(/날짜 범위: 없음/)).toBeVisible()

    await userEvent.click(screen.getByRole("button", { name: "전체 교체 복원" }))
    expect(screen.getByText("확인 문구 REPLACE를 입력해야 합니다.")).toBeVisible()

    await userEvent.type(screen.getByLabelText("확인 문구"), "REPLACE")
    await userEvent.click(screen.getByRole("button", { name: "전체 교체 복원" }))

    expect(downloads.downloads[0]?.fileName).toBe("home-training-level-up-pre-restore.json")
    expect(onRestoreConfirmed).toHaveBeenCalledWith(restoredState)
    expect(
      await screen.findByText("현재 상태를 백업하고 저장 확인 후 전체 교체했습니다."),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "전체 교체 복원" })).toHaveFocus()
  })

  it("shows a typed failure instead of success when the async restore save fails", async () => {
    const downloads = new MemoryDownloadPort()
    const onRestoreConfirmed = vi.fn<(state: StoredState) => Promise<SettingsRestoreCommitResult>>()
    onRestoreConfirmed.mockResolvedValue({ kind: "failed", reason: "storageSaveFailed" })

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={downloads}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={onRestoreConfirmed}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )

    await userEvent.upload(
      screen.getByLabelText("백업 파일 선택"),
      fileWithContent(exportStoredState(createCompletedOnboardingState())),
    )
    await userEvent.type(screen.getByLabelText("확인 문구"), "REPLACE")
    await userEvent.click(screen.getByRole("button", { name: "전체 교체 복원" }))

    await waitFor(() => expect(onRestoreConfirmed).toHaveBeenCalled())
    expect(screen.getByText("저장에 실패해 현재 상태를 유지했습니다.")).toBeVisible()
    expect(
      screen.queryByText("현재 상태를 백업하고 저장 확인 후 전체 교체했습니다."),
    ).not.toBeInTheDocument()
  })

  it("keeps restore blocked when no preview exists or pre-restore backup fails", async () => {
    const onRestoreConfirmed = vi.fn<(state: StoredState) => SettingsRestoreCommitResult>()
    const view = render(
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

    await userEvent.click(screen.getByRole("button", { name: "전체 교체 복원" }))
    expect(screen.getByText("먼저 백업 파일을 선택하세요.")).toBeVisible()
    expect(screen.getByLabelText("백업 파일 선택")).toHaveFocus()
    expect(onRestoreConfirmed).not.toHaveBeenCalled()

    view.rerender(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new FailingDownloadPort()}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={onRestoreConfirmed}
        onThemeChange={() => undefined}
        reducedMotion="system"
        theme="light"
      />,
    )
    await userEvent.upload(
      screen.getByLabelText("백업 파일 선택"),
      fileWithContent(exportStoredState(createCompletedOnboardingState())),
    )
    await userEvent.type(screen.getByLabelText("확인 문구"), "REPLACE")
    await userEvent.click(screen.getByRole("button", { name: "전체 교체 복원" }))

    expect(screen.getByText("복원 전 현재 백업 저장에 실패했습니다.")).toBeVisible()
    expect(onRestoreConfirmed).not.toHaveBeenCalled()
  })

  it("reports unknown restore save exceptions without claiming success", async () => {
    const onRestoreConfirmed = vi.fn<(state: StoredState) => Promise<SettingsRestoreCommitResult>>()
    onRestoreConfirmed.mockRejectedValue(new DOMException("blocked", "SecurityError"))

    render(
      <SettingsView
        currentState={createCompletedOnboardingState()}
        downloads={new MemoryDownloadPort()}
        onReducedMotionChange={() => undefined}
        onRestoreConfirmed={onRestoreConfirmed}
        onThemeChange={() => undefined}
        reducedMotion="reduce"
        theme="dark"
      />,
    )

    await userEvent.upload(
      screen.getByLabelText("백업 파일 선택"),
      fileWithContent(exportStoredState(createCompletedOnboardingState())),
    )
    await userEvent.type(screen.getByLabelText("확인 문구"), "REPLACE")
    await userEvent.click(screen.getByRole("button", { name: "전체 교체 복원" }))

    expect(
      await screen.findByText("알 수 없는 저장 오류로 현재 상태를 유지했습니다."),
    ).toBeVisible()
    expect(screen.getByRole("checkbox", { name: "움직임 줄이기" })).toBeChecked()
  })
})

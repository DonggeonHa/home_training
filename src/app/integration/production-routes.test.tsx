import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "../../App"
import { APP_STORAGE_KEY } from "../../storage"
import { exportStoredState } from "../../storage/backup"
import type { StoredState } from "../../storage/schemas"
import { MemoryDownloadPort, MemoryStoragePort } from "../../storage/test-ports"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { renderInStaticShell } from "../../test/static-shell"

function renderProductionApp(
  path: string,
  storage = createSeededStorage(),
  downloads = new MemoryDownloadPort(),
) {
  window.location.hash = path

  return renderInStaticShell(<App downloads={downloads} storage={storage} />)
}

function createSeededStorage(state = createCompletedOnboardingState()) {
  const storage = new MemoryStoragePort()
  storage.values.set(APP_STORAGE_KEY, JSON.stringify(state))
  return storage
}

function readPersistedState(storage: MemoryStoragePort): StoredState {
  const rawState = storage.values.get(APP_STORAGE_KEY)
  expect(rawState).toBeDefined()

  return JSON.parse(rawState ?? "{}") as StoredState
}

function fileWithContent(content: string) {
  return new File([content], "backup.json", { type: "application/json" })
}

describe("production route integration", () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it("renders the dashboard home route with six category cards and a workout CTA", async () => {
    const storage = createSeededStorage()

    renderProductionApp("/", storage)

    expect(
      await screen.findByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
    ).toBeVisible()
    expect(screen.getAllByRole("article", { name: /카테고리 카드/ })).toHaveLength(6)
    expect(screen.getByRole("link", { name: "루틴 A 운동 시작" })).toHaveAttribute(
      "href",
      "#/workout",
    )
    expect(document.title).toBe("오늘의 대시보드 | 홈트레이닝 LEVEL UP")
  })

  it("routes workout, levels, selected category, record, settings, legacy, and not-found paths", async () => {
    const storage = createSeededStorage()

    renderProductionApp("/workout", storage)
    expect(await screen.findByRole("heading", { level: 1, name: /Routine A/ })).toBeVisible()
    expect(screen.getByRole("link", { name: "운동" })).toHaveAttribute("aria-current", "page")
    expect(document.title).toBe("운동 세션 | 홈트레이닝 LEVEL UP")

    cleanup()
    renderProductionApp("/levels", storage)
    expect(await screen.findByRole("heading", { level: 1, name: "전체 스킬트리" })).toBeVisible()
    expect(screen.getAllByRole("list", { name: /스킬트리/ })).toHaveLength(6)

    cleanup()
    renderProductionApp("/levels/push", storage)
    expect(await screen.findByRole("heading", { level: 1, name: "PUSH 스킬트리" })).toBeVisible()
    expect(screen.getAllByRole("list", { name: /스킬트리/ })).toHaveLength(1)

    cleanup()
    renderProductionApp("/record", storage)
    expect(await screen.findByRole("heading", { level: 1, name: "기록과 성장" })).toBeVisible()

    cleanup()
    renderProductionApp("/settings", storage)
    expect(await screen.findByRole("heading", { level: 1, name: "설정과 백업" })).toBeVisible()

    cleanup()
    renderProductionApp("/plan", storage)
    await waitFor(() => expect(window.location.hash).toBe("#/settings"))
    expect(await screen.findByRole("heading", { level: 1, name: "설정과 백업" })).toBeVisible()

    cleanup()
    renderProductionApp("/missing", storage)
    expect(
      await screen.findByRole("heading", { level: 1, name: "페이지를 찾을 수 없습니다" }),
    ).toBeVisible()
  })

  it("keeps onboarding global for normal and unknown routes", () => {
    renderProductionApp("/settings", new MemoryStoragePort())
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()

    cleanup()
    renderProductionApp("/missing", new MemoryStoragePort())
    expect(screen.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
  })

  it("persists workout active-session patches and atomically completes back to dashboard", async () => {
    const storage = createSeededStorage()
    const user = userEvent.setup()

    renderProductionApp("/workout", storage)

    await user.click(await screen.findByRole("button", { name: "공통 워밍업 완료" }))
    await waitFor(() => expect(readPersistedState(storage).activeSession).not.toBeNull())

    await stopCurrentCategoryByPain(user, "반복 수", "15")
    await stopCurrentCategoryByPain(user, "반복 수", "10")
    await confirmPullChecklist(user)
    await stopCurrentCategoryByPain(user, "초", "30")
    await stopCurrentCategoryByPain(user, "초", "45")

    await waitFor(() => expect(window.location.hash).toBe("#/"))
    expect(screen.getByRole("status")).toHaveTextContent("루틴 A 완료")
    expect(screen.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" })).toBeVisible()
    expect(readPersistedState(storage)).toMatchObject({
      activeSession: null,
      nextRoutine: "B",
      completedSessions: [
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ sets: [expect.objectContaining({ kind: "single" })] }),
          ]),
          routineId: "A",
        }),
      ],
    })
  })

  it("applies settings theme, motion, and confirmed full-state replacement immediately", async () => {
    const storage = createSeededStorage()
    const user = userEvent.setup()
    const restoredState = {
      ...createCompletedOnboardingState(),
      nextRoutine: "C",
      completedSessions: [],
    } satisfies StoredState

    renderProductionApp("/settings", storage)
    await screen.findByRole("heading", { level: 1, name: "설정과 백업" })

    await user.selectOptions(screen.getByLabelText("테마"), "dark")
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-theme", "dark")

    await user.click(screen.getByRole("checkbox", { name: "움직임 줄이기" }))
    expect(screen.getByTestId("app-shell")).toHaveClass("motion-reduce")

    await user.upload(
      screen.getByLabelText("백업 파일 선택"),
      fileWithContent(exportStoredState(restoredState)),
    )
    expect(await screen.findByText("복원 미리보기: 기록 0개")).toBeVisible()
    await user.type(screen.getByLabelText("확인 문구"), "REPLACE")
    await user.click(screen.getByRole("button", { name: "전체 교체 복원" }))

    expect(
      await screen.findByText("현재 상태를 백업하고 저장 확인 후 전체 교체했습니다."),
    ).toBeVisible()
    expect(readPersistedState(storage).nextRoutine).toBe("C")

    window.location.hash = "#/"
    await waitFor(() => expect(screen.getByText("다음 추천 루틴 C")).toBeVisible())
  })

  it("reports restore save failure without replacing current state", async () => {
    const storage = createSeededStorage()
    const user = userEvent.setup()
    const restoredState = {
      ...createCompletedOnboardingState(),
      nextRoutine: "C",
    } satisfies StoredState

    renderProductionApp("/settings", storage)
    await screen.findByRole("heading", { level: 1, name: "설정과 백업" })

    await user.upload(
      screen.getByLabelText("백업 파일 선택"),
      fileWithContent(exportStoredState(restoredState)),
    )
    await user.type(screen.getByLabelText("확인 문구"), "REPLACE")
    storage.writeError = new DOMException("blocked", "SecurityError")
    await user.click(screen.getByRole("button", { name: "전체 교체 복원" }))

    expect(await screen.findByText("저장에 실패해 현재 상태를 유지했습니다.")).toBeVisible()
    expect(readPersistedState(storage).nextRoutine).toBe("A")
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

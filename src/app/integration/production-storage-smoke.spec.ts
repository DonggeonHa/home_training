import { expect, test } from "@playwright/test"
import { SessionIdSchema } from "../../domain/schemas"
import { exportStoredState } from "../../storage/backup"
import type { StoredState } from "../../storage/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import {
  APP_STORAGE_KEY,
  createStateWithCompletedSession,
  evidenceDirectory,
  findHorizontalOverflow,
  readStoredState,
  seedCompletedState,
} from "./production-smoke-helpers"

test.describe("production storage and settings smoke", () => {
  test("applies settings theme and restores a backup in production smoke", async ({ page }) => {
    const restoredState = {
      ...createCompletedOnboardingState(),
      completedSessions: [],
      nextRoutine: "C",
    } satisfies StoredState

    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "light")
    await page.goto("/#/settings")

    await page.getByLabel("테마").selectOption("dark")
    await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark")
    await page.getByRole("checkbox", { name: "움직임 줄이기" }).check()
    await expect(page.locator(".app-shell")).toHaveClass(/motion-reduce/)
    await page.getByLabel("백업 파일 선택").setInputFiles({
      buffer: Buffer.from(exportStoredState(restoredState)),
      mimeType: "application/json",
      name: "backup.json",
    })
    await expect(page.getByText("복원 미리보기: 기록 0개")).toBeVisible()
    await page.getByLabel("확인 문구").fill("REPLACE")
    await page.getByRole("button", { name: "전체 교체 복원" }).click()

    await expect(
      page.getByText("현재 상태를 백업하고 저장 확인 후 전체 교체했습니다."),
    ).toBeVisible()
    await page.goto("/#/")
    await expect(page.getByText("다음 추천 루틴 C")).toBeVisible()
    await expect.poll(() => findHorizontalOverflow(page)).toEqual([])
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/settings-restore-theme-mobile.png`,
    })
  })

  test("shows history and preserves test-unlocked progress after failed level-test seed", async ({
    page,
  }) => {
    const seededState = createStateWithCompletedSession({
      progress: {
        ...createCompletedOnboardingState().progress,
        push: {
          ...createCompletedOnboardingState().progress.push,
          level: 1,
          qualifiedSessionIds: [
            SessionIdSchema.parse("11111111-1111-4111-8111-111111111111"),
            SessionIdSchema.parse("22222222-2222-4222-8222-222222222222"),
          ],
          status: "testUnlocked",
        },
      },
    })
    await seedCompletedState(page, seededState, "light")

    await page.goto("/#/record")
    await expect(page.getByRole("heading", { level: 1, name: "기록과 성장" })).toBeVisible()
    await expect(page.getByRole("list", { name: "완료 세션 목록" })).toContainText("PUSH Lv.1")

    await page.goto("/#/levels/push")
    await expect(page.getByText("Lv.1")).toBeVisible()
    expect((await readStoredState(page)).progress.push.status).toBe("testUnlocked")
  })

  test("exports valid JSON and rejects malformed import without replacing state", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createStateWithCompletedSession(), "light")
    await page.goto("/#/settings")

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "JSON 백업 내보내기" }).click()
    expect((await download).suggestedFilename()).toBe("home-training-level-up-backup.json")

    await page.getByLabel("백업 파일 선택").setInputFiles({
      buffer: Buffer.from("{not-json"),
      mimeType: "application/json",
      name: "broken.json",
    })
    await expect(page.getByText("가져오기 파일을 읽을 수 없습니다.")).toBeVisible()
    expect((await readStoredState(page)).completedSessions).toHaveLength(1)
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/settings-malformed-import-mobile.png`,
    })
  })

  test("recovers corrupt storage and still renders the onboarding gate", async ({ page }) => {
    await page.addInitScript((storageKey) => {
      localStorage.setItem(storageKey, "{corrupt")
    }, APP_STORAGE_KEY)

    await page.goto("/#/settings")

    await expect(page.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    await expect(
      page.getByRole("heading", { level: 2, name: "저장된 데이터를 복구했습니다" }),
    ).toBeVisible()
  })
})

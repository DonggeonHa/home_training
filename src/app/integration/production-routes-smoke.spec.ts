import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { APP_STORAGE_KEY } from "../../storage"
import { exportStoredState } from "../../storage/backup"
import type { StoredState } from "../../storage/schemas"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"

const evidenceDirectory = ".omo/evidence/home-training/task-12a/screenshots"
const viewports = [
  { height: 812, name: "mobile", width: 375 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 900, name: "desktop", width: 1280 },
] as const
const themes = ["light", "dark"] as const

const routeCases = [
  { hash: "#/", heading: "오늘의 진행 대시보드", name: "dashboard" },
  { hash: "#/workout", heading: /Routine A/, name: "workout" },
  { hash: "#/levels", heading: "전체 스킬트리", name: "levels" },
  { hash: "#/levels/push", heading: "PUSH 스킬트리", name: "levels-push" },
  { hash: "#/record", heading: "기록과 성장", name: "record" },
  { hash: "#/settings", heading: "설정과 백업", name: "settings" },
] as const

test.describe("production route smoke", () => {
  for (const viewport of viewports) {
    for (const theme of themes) {
      for (const routeCase of routeCases) {
        test(`renders ${routeCase.name} at ${viewport.name} in ${theme} without overflow, console errors, or axe violations`, async ({
          page,
        }) => {
          const consoleErrors = captureConsoleErrors(page)

          await page.setViewportSize({ height: viewport.height, width: viewport.width })
          await seedCompletedState(page, createCompletedOnboardingState(), theme)
          await page.goto(`/${routeCase.hash}`)

          await expect(
            page.getByRole("heading", { level: 1, name: routeCase.heading }),
          ).toBeVisible()
          await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", theme)
          await expect.poll(() => findHorizontalOverflow(page)).toEqual([])

          const results = await new AxeBuilder({ page }).analyze()
          expect(results.violations).toEqual([])
          expect(consoleErrors).toEqual([])

          await page.screenshot({
            fullPage: true,
            path: `${evidenceDirectory}/${routeCase.name}-${theme}-${viewport.name}.png`,
          })
        })
      }
    }
  }

  test("resumes an active workout session after a production reload", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    await page.getByRole("button", { name: "공통 워밍업 완료" }).click()
    await page.waitForFunction((storageKey) => {
      const rawState = localStorage.getItem(storageKey)
      if (rawState === null) {
        return false
      }
      const state = JSON.parse(rawState) as { readonly activeSession?: unknown }
      return state.activeSession !== null && state.activeSession !== undefined
    }, APP_STORAGE_KEY)
    await page.reload()

    await expect(page.getByRole("heading", { level: 1, name: /Routine A/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "공통 워밍업 완료" })).toBeDisabled()
    await expect.poll(() => findHorizontalOverflow(page)).toEqual([])
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/workout-resume-mobile.png`,
    })
  })

  test("keeps the closed workout abandon dialog from intercepting mobile actions", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/workout")

    const currentHeading = page.getByRole("heading", { level: 1, name: /Routine A ·/ })
    const headingBeforeAdvance = await currentHeading.textContent()
    await expect(page.locator(".workout-dialog")).not.toHaveAttribute("open", "")
    await expect(page.locator(".workout-dialog")).toHaveCSS("display", "none")
    await expect(page.locator(".workout-dialog")).toHaveCSS("pointer-events", "none")

    const nextCategoryButton = page.getByRole("button", { name: "다음 카테고리" })
    const hitTest = await nextCategoryButton.evaluate((button) => {
      const rect = button.getBoundingClientRect()
      const hitElement = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      )

      return hitElement === button || button.contains(hitElement)
    })
    expect(hitTest).toBe(true)

    await nextCategoryButton.click()
    await expect.poll(async () => currentHeading.textContent()).not.toBe(headingBeforeAdvance)
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/workout-closed-dialog-mobile.png`,
    })
  })

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
})

function captureConsoleErrors(page: Page) {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  return consoleErrors
}

async function seedCompletedState(page: Page, state: StoredState, theme: (typeof themes)[number]) {
  await page.addInitScript(
    ([storageKey, storedState, themePreference]) => {
      if (localStorage.getItem(storageKey) === null) {
        localStorage.setItem(storageKey, JSON.stringify(storedState))
      }
      localStorage.setItem("home-training-theme", themePreference)
    },
    [APP_STORAGE_KEY, state, theme] as const,
  )
}

async function findHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth <= clientWidth + 1) {
      return []
    }

    return [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => element.getBoundingClientRect().right > clientWidth + 1)
      .slice(0, 5)
      .map((element) => ({
        className: element.className.toString(),
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        tagName: element.tagName.toLowerCase(),
        text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
        width: Math.round(element.getBoundingClientRect().width),
      }))
  })
}

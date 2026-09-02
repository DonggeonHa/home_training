import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import {
  APP_STORAGE_KEY,
  captureConsoleErrors,
  EXERCISE_CATALOG,
  evidenceDirectory,
  findHorizontalOverflow,
  findMainContentNavIntersections,
  scrollMainContent,
  seedCompletedState,
  themes,
  viewports,
} from "./production-smoke-helpers"

const routeCases = [
  { hash: "#/", heading: "오늘의 진행 대시보드", name: "dashboard" },
  { hash: "#/workout", heading: /Routine A/, name: "workout" },
  { hash: "#/levels", heading: "전체 스킬트리", name: "levels" },
  { hash: "#/levels/push", heading: "PUSH 스킬트리", name: "levels-push" },
  { hash: "#/record", heading: "기록과 성장", name: "record" },
  { hash: "#/settings", heading: "설정과 백업", name: "settings" },
] as const

test.describe("production route smoke", () => {
  test("completes safety onboarding in a production browser", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await page.goto("/#/")

    await expect(page.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
    await page.getByRole("button", { name: "안전 확인 제출" }).click()

    await expect(page.getByRole("button", { name: "기초 레벨 평가 시작" })).toBeVisible()
    const persisted = await page.evaluate(
      (storageKey) => localStorage.getItem(storageKey),
      APP_STORAGE_KEY,
    )
    expect(persisted).toContain('"safety":{"cleared":true')
    expect(persisted).not.toContain("chestPain")
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDirectory}/onboarding-safety-mobile.png`,
    })
  })

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

  test("keeps dashboard content out of the mobile navigation space while scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 })
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await page.goto("/#/")
    await expect(
      page.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
    ).toBeVisible()

    for (const scrollPosition of ["top", "middle", "bottom"] as const) {
      await scrollMainContent(page, scrollPosition)
      expect(await findMainContentNavIntersections(page)).toEqual([])
      await page.screenshot({
        fullPage: true,
        path: `${evidenceDirectory}/dashboard-mobile-nav-clear-${scrollPosition}.png`,
      })
    }
  })

  test("renders every category skill tree from a schema-validated seeded state", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1280 })
    await seedCompletedState(page, createCompletedOnboardingState(), "light")

    for (const category of EXERCISE_CATALOG) {
      await page.goto(`/#/levels/${category.id}`)
      await expect(
        page.getByRole("heading", { level: 1, name: `${category.title} 스킬트리` }),
      ).toBeVisible()
      await expect(page.getByRole("list", { name: `${category.title} 스킬트리` })).toBeVisible()
    }
  })
})

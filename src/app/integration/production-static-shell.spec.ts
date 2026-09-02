import { expect, test } from "@playwright/test"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import {
  findHorizontalOverflow,
  seedCompletedState,
  themes,
  viewports,
} from "./production-smoke-helpers"

test.describe("production persistent static shell", () => {
  test("shows the persistent header without entry JavaScript", async ({ page }) => {
    await page.route("**/assets/*.js", (route) => route.abort())
    await page.goto("/#/")

    const header = page.getByRole("banner")
    await expect(
      header.getByRole("heading", { level: 1, name: "홈트레이닝 LEVEL UP" }),
    ).toBeVisible()
    await expect(header.getByText("LOCAL TRAINING SYSTEM")).toBeVisible()
    await expect(header.getByText("집에서도 안전하게, 오늘 할 운동만 선명하게.")).toBeVisible()
    await expect(page.locator("#app-host.app-shell")).toBeVisible()
  })

  test("keeps the same header node connected after React mounts", async ({ page }) => {
    await seedCompletedState(page, createCompletedOnboardingState(), "light")
    await page.goto("/#/")
    await page.locator(".app-nav").waitFor()

    const headerStayedConnected = await page.evaluate(() => {
      const header = document.querySelector(".app-header")
      const root = document.querySelector("#root")

      return {
        brandHeadingCount: document.querySelectorAll(".app-header h1.brand-title").length,
        headerConnected: header?.isConnected ?? false,
        isStaticHeader: header?.parentElement?.id === "app-host",
        rootDisplay: root === null ? "" : window.getComputedStyle(root).display,
      }
    })

    expect(headerStayedConnected).toEqual({
      brandHeadingCount: 1,
      headerConnected: true,
      isStaticHeader: true,
      rootDisplay: "contents",
    })
  })

  test("supports header actions and skip focus without changing hash", async ({ page }) => {
    await page.goto("/#/")
    const originalUrl = page.url()

    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused()
    await page.keyboard.press("Enter")

    await expect(page.getByRole("main")).toBeFocused()
    expect(page.url()).toBe(originalUrl)

    await page.getByRole("button", { name: "안전 원칙" }).click()
    await expect(page.getByRole("dialog", { name: "안전 원칙" })).toBeVisible()
    await page.getByRole("button", { exact: true, name: "닫기" }).click()
  })

  for (const viewport of viewports) {
    for (const theme of themes) {
      test(`keeps static shell stable at ${viewport.name} in ${theme}`, async ({ page }) => {
        await page.setViewportSize({ height: viewport.height, width: viewport.width })
        await seedCompletedState(page, createCompletedOnboardingState(), theme)
        await page.goto("/#/")

        await expect(page.locator("#app-host")).toHaveAttribute("data-theme", theme)
        await expect(
          page.getByRole("heading", { level: 1, name: "홈트레이닝 LEVEL UP" }),
        ).toBeVisible()
        await expect(
          page.getByRole("heading", { level: 1, name: "오늘의 진행 대시보드" }),
        ).toBeVisible()
        await expect.poll(() => findHorizontalOverflow(page)).toEqual([])
      })
    }
  }
})

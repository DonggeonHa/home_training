import { expect, test } from "@playwright/test"
import { createCompletedOnboardingState } from "../../test/onboarding-fixtures"
import { routeDistSubpath, seedCompletedState } from "./production-smoke-helpers"

test.describe("production subpath smoke", () => {
  test("serves the HashRouter app from a deployment subpath", async ({ page }) => {
    await seedCompletedState(page, createCompletedOnboardingState(), "dark")
    await routeDistSubpath(page, "home_training")

    await page.goto("/home_training/#/settings")

    await expect(page.getByRole("heading", { level: 1, name: "설정과 백업" })).toBeVisible()
    await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark")
  })
})

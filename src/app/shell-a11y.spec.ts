import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const routeCases = [
  { hash: "#/", heading: "운동 전 안전 확인", theme: "light" },
  { hash: "#/", heading: "운동 전 안전 확인", theme: "dark" },
  { hash: "#/levels", heading: "운동 전 안전 확인", theme: "light" },
  { hash: "#/levels", heading: "운동 전 안전 확인", theme: "dark" },
  { hash: "#/record", heading: "운동 전 안전 확인", theme: "light" },
  { hash: "#/record", heading: "운동 전 안전 확인", theme: "dark" },
  { hash: "#/plan", heading: "운동 전 안전 확인", theme: "light" },
  { hash: "#/plan", heading: "운동 전 안전 확인", theme: "dark" },
  { hash: "#/unsupported", heading: "운동 전 안전 확인", theme: "light" },
  { hash: "#/unsupported", heading: "운동 전 안전 확인", theme: "dark" },
] as const

test.describe("app shell accessibility", () => {
  for (const routeCase of routeCases) {
    test(`has zero axe violations at ${routeCase.hash} in ${routeCase.theme}`, async ({ page }) => {
      await page.addInitScript(
        (theme) => localStorage.setItem("home-training-theme", theme),
        routeCase.theme,
      )
      await page.goto(`/${routeCase.hash}`)

      await expect(page.getByRole("heading", { level: 1, name: routeCase.heading })).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  }

  test("focuses the main landmark when the skip link is activated", async ({ page }) => {
    await page.goto("/#/")
    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused()

    await page.keyboard.press("Enter")

    await expect(page.getByRole("main")).toBeFocused()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByRole("heading", { level: 1, name: "운동 전 안전 확인" })).toBeVisible()
  })

  test("opens the safety principles dialog as a modal and restores focus", async ({ page }) => {
    await page.goto("/#/")
    const trigger = page.getByRole("button", { name: "안전 원칙" })

    await trigger.click()

    const dialog = page.getByRole("dialog", { name: "안전 원칙" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText("통증이 있으면 즉시 중단합니다.")).toBeVisible()
    await expect(dialog.getByText("자세가 흐트러지면 반복을 멈춥니다.")).toBeVisible()
    await expect(dialog).toHaveJSProperty("open", true)
    expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true)

    await page.keyboard.press("Escape")

    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})
